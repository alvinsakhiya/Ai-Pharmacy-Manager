"""Forecasting engine tests (deterministic synthetic series)."""
from datetime import date, timedelta

import pytest

from apps.forecasting.backtest import MIN_HISTORY_WEEKS, backtest_medicine
from apps.forecasting.engine import forecast_medicine
from apps.stock.models import MedicineUsage


def _seed_usage(medicine, weeks, base=50, weekly_growth=0):
    start = date.today() - timedelta(weeks=weeks)
    d = start
    week = 0
    rows = []
    while d <= date.today():
        qty = max(0, int(base + weekly_growth * (week / 4)))
        rows.append(MedicineUsage(medicine=medicine, date=d, quantity=qty))
        d += timedelta(days=1)
        if d.weekday() == 0:
            week += 1
    MedicineUsage.objects.bulk_create(rows)


@pytest.mark.django_db
def test_no_history_returns_empty(medicine):
    result = forecast_medicine(medicine, 4)
    assert result.points == []
    assert "No historical usage" in result.explanation


@pytest.mark.django_db
def test_moving_average_for_short_history(medicine):
    _seed_usage(medicine, weeks=3, base=30)
    result = forecast_medicine(medicine, 4)
    assert result.method == "moving_average"
    assert len(result.points) == 4
    assert result.points[0].mean > 0


@pytest.mark.django_db
def test_trend_detected_on_growing_series(medicine):
    _seed_usage(medicine, weeks=20, base=40, weekly_growth=20)
    result = forecast_medicine(medicine, 4)
    assert result.method in ("holt_linear_trend", "holt_winters", "linear_trend")
    assert result.trend_per_week > 0
    # confidence band widens with horizon
    spans = [p.upper - p.lower for p in result.points]
    assert spans[-1] >= spans[0]


@pytest.mark.django_db
def test_reorder_recommendation_present(medicine):
    _seed_usage(medicine, weeks=16, base=60)
    result = forecast_medicine(medicine, 4)
    assert "should_order" in result.reorder
    assert result.reorder["on_hand"] == medicine.quantity_on_hand()


@pytest.mark.django_db
def test_forecast_api(auth, medicine):
    _seed_usage(medicine, weeks=12, base=25)
    res = auth("dispenser").get(f"/api/forecast/medicine/{medicine.id}/?horizon=4")
    assert res.status_code == 200
    assert res.data["medicine_label"] == medicine.label
    assert len(res.data["forecast"]) == 4


@pytest.mark.django_db
def test_forecast_api_returns_404_for_unknown_medicine(auth):
    response = auth("dispenser").get("/api/forecast/medicine/999999/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_forecast_api_rejects_invalid_horizon(auth, medicine):
    response = auth("dispenser").get(
        f"/api/forecast/medicine/{medicine.id}/?horizon=invalid"
    )
    assert response.status_code == 400


# --- Model-evaluation harness (rolling-origin backtesting) ---------------------

@pytest.mark.django_db
def test_backtest_insufficient_history_flagged(medicine):
    _seed_usage(medicine, weeks=4, base=30)
    result = backtest_medicine(medicine)
    assert result.insufficient_history is True
    assert result.folds == 0
    assert result.methods == []


@pytest.mark.django_db
def test_backtest_reports_metrics_per_method(medicine):
    # Gentle growth -> the series varies week to week, so the naive baseline is
    # imperfect and every metric (incl. the skill score) is well defined.
    _seed_usage(medicine, weeks=MIN_HISTORY_WEEKS + 8, base=50, weekly_growth=6)
    result = backtest_medicine(medicine)

    assert result.insufficient_history is False
    assert result.folds >= 4
    methods = {m.method for m in result.methods}
    # baselines + real methods all evaluated over the same folds
    assert {"naive", "seasonal_naive", "moving_average", "holt_winters"} <= methods
    for m in result.methods:
        assert m.mae >= 0
        assert m.rmse >= 0
        assert m.mase is None or m.mase >= 0
    # naive is its own baseline, so its skill score is ~0
    naive = next(m for m in result.methods if m.method == "naive")
    assert naive.skill_vs_naive is not None
    assert abs(naive.skill_vs_naive) < 1e-9


@pytest.mark.django_db
def test_backtest_flat_series_skill_is_undefined(medicine):
    # A perfectly flat series: the naive forecast is exact (RMSE 0), so the skill
    # score is legitimately undefined rather than a divide-by-zero crash.
    _seed_usage(medicine, weeks=MIN_HISTORY_WEEKS + 4, base=50)
    result = backtest_medicine(medicine)
    naive = next(m for m in result.methods if m.method == "naive")
    assert naive.rmse == 0
    assert naive.skill_vs_naive is None


@pytest.mark.django_db
def test_backtest_best_method_beats_naive_on_trend(medicine):
    # A strong, low-noise upward trend: a trend model must beat "repeat last week".
    _seed_usage(medicine, weeks=MIN_HISTORY_WEEKS + 12, base=20, weekly_growth=40)
    result = backtest_medicine(medicine)

    best = next(m for m in result.methods if m.method == result.best_method)
    assert best.is_baseline is False
    naive = next(m for m in result.methods if m.method == "naive")
    # the selected method should not be worse than the naive baseline
    assert best.rmse <= naive.rmse + 1e-6
    assert result.best_method in {
        "moving_average", "linear_trend", "holt_linear_trend", "holt_winters",
    }


@pytest.mark.django_db
def test_backtest_api(auth, medicine):
    _seed_usage(medicine, weeks=MIN_HISTORY_WEEKS + 6, base=40)
    res = auth("dispenser").get(f"/api/forecast/medicine/{medicine.id}/backtest/")
    assert res.status_code == 200
    assert res.data["medicine_label"] == medicine.label
    assert res.data["folds"] >= 1
    assert len(res.data["methods"]) == 6
    assert res.data["best_method"]


@pytest.mark.django_db
def test_backtest_api_404_for_unknown_medicine(auth):
    res = auth("dispenser").get("/api/forecast/medicine/999999/backtest/")
    assert res.status_code == 404
