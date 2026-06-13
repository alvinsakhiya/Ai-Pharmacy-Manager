"""Forecasting engine tests (deterministic synthetic series)."""
from datetime import date, timedelta

import pytest

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
