"""Demand-forecasting engine.

Academic demonstration of stock-demand forecasting from historical usage. The
engine is intentionally *explainable*: it reports which method it selected, the
underlying trend and volatility, and a confidence band — rather than acting as a
black box. It is a decision-support aid, not a clinical decision-maker.

Method selection (automatic, based on data availability):
    < 6 weeks of history  -> Moving Average (flat mean of recent weeks)
    6-11 weeks            -> Holt linear trend (level + trend)
    >= 12 weeks           -> Holt-Winters (level + trend + seasonality)

statsmodels is used when available; if it is not installed (or a fit fails) the
engine degrades gracefully to a NumPy least-squares linear trend, so the API
never hard-fails. Confidence intervals come from the in-sample residual standard
deviation, widened with the forecast horizon (sqrt(h)) to reflect compounding
uncertainty.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np

try:  # statsmodels is optional; the engine works without it.
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    _HAS_SM = True
except Exception:  # pragma: no cover - exercised only when dependency missing
    _HAS_SM = False

Z_95 = 1.96
SEASONAL_PERIODS = 4  # ~monthly seasonality over weekly buckets


@dataclass
class ForecastPoint:
    week_start: date
    mean: float
    lower: float
    upper: float


@dataclass
class ForecastResult:
    medicine_id: int
    method: str
    horizon_weeks: int
    history_weeks: list[dict] = field(default_factory=list)
    points: list[ForecastPoint] = field(default_factory=list)
    avg_weekly_demand: float = 0.0
    trend_per_week: float = 0.0
    volatility: float = 0.0
    confidence: float = 0.95
    explanation: str = ""
    reorder: dict = field(default_factory=dict)

    def as_dict(self):
        return {
            "medicine_id": self.medicine_id,
            "method": self.method,
            "horizon_weeks": self.horizon_weeks,
            "confidence": self.confidence,
            "avg_weekly_demand": round(self.avg_weekly_demand, 1),
            "trend_per_week": round(self.trend_per_week, 2),
            "volatility": round(self.volatility, 1),
            "history": self.history_weeks,
            "forecast": [
                {
                    "week_start": p.week_start.isoformat(),
                    "mean": round(p.mean, 1),
                    "lower": round(p.lower, 1),
                    "upper": round(p.upper, 1),
                }
                for p in self.points
            ],
            "explanation": self.explanation,
            "reorder": self.reorder,
        }


def _weekly_series(medicine) -> tuple[list[date], np.ndarray]:
    """Build a contiguous weekly demand series (zero-filled) from MedicineUsage."""
    usage = list(medicine.usage.order_by("date").values_list("date", "quantity"))
    if not usage:
        return [], np.array([])

    start = usage[0][0]
    end = usage[-1][0]
    # Daily map then bucket into ISO weeks anchored on Mondays.
    daily = {d: q for d, q in usage}
    week_start = start - timedelta(days=start.weekday())
    weeks, values = [], []
    cur = week_start
    while cur <= end:
        total = sum(daily.get(cur + timedelta(days=i), 0) for i in range(7))
        weeks.append(cur)
        values.append(total)
        cur += timedelta(days=7)
    return weeks, np.array(values, dtype=float)


def _linear_trend_forecast(values: np.ndarray, horizon: int):
    """NumPy least-squares fallback: fit y = a*x + b."""
    n = len(values)
    x = np.arange(n)
    a, b = np.polyfit(x, values, 1)
    fitted = a * x + b
    resid_std = float(np.std(values - fitted)) or 1.0
    future_x = np.arange(n, n + horizon)
    mean = a * future_x + b
    return np.clip(mean, 0, None), resid_std, float(a)


def forecast_medicine(medicine, horizon_weeks: int = 4) -> ForecastResult:
    weeks, values = _weekly_series(medicine)
    result = ForecastResult(medicine_id=medicine.id, method="none",
                            horizon_weeks=horizon_weeks)

    if len(values) == 0:
        result.explanation = "No historical usage recorded; cannot forecast."
        return result

    # Trim a partial trailing week if it looks incomplete is skipped for simplicity.
    result.history_weeks = [
        {"week_start": w.isoformat(), "quantity": int(v)} for w, v in zip(weeks, values)
    ]
    n = len(values)
    last_week = weeks[-1]
    future_weeks = [last_week + timedelta(days=7 * (i + 1)) for i in range(horizon_weeks)]

    method = "moving_average"
    trend = 0.0
    if n < 6:
        recent = values[-min(n, 4):]
        mean_val = float(np.mean(recent))
        resid_std = float(np.std(recent)) or max(1.0, 0.1 * mean_val)
        means = np.full(horizon_weeks, mean_val)
    else:
        used_sm = False
        if _HAS_SM:
            try:
                seasonal = "add" if n >= 2 * SEASONAL_PERIODS else None
                model = ExponentialSmoothing(
                    values, trend="add", damped_trend=True,
                    seasonal=seasonal,
                    seasonal_periods=SEASONAL_PERIODS if seasonal else None,
                    initialization_method="estimated",
                )
                fit = model.fit(optimized=True)
                means = np.clip(np.asarray(fit.forecast(horizon_weeks)), 0, None)
                resid = values - np.asarray(fit.fittedvalues)
                resid_std = float(np.std(resid)) or 1.0
                trend = float(np.polyfit(np.arange(n), values, 1)[0])
                method = "holt_winters" if seasonal else "holt_linear_trend"
                used_sm = True
            except Exception:
                used_sm = False
        if not used_sm:
            means, resid_std, trend = _linear_trend_forecast(values, horizon_weeks)
            method = "linear_trend"

    points = []
    for h, (w, m) in enumerate(zip(future_weeks, means), start=1):
        band = Z_95 * resid_std * math.sqrt(h)
        points.append(ForecastPoint(w, float(m), max(0.0, m - band), m + band))

    result.method = method
    result.points = points
    result.avg_weekly_demand = float(np.mean(values[-min(n, 12):]))
    result.trend_per_week = trend
    result.volatility = float(np.std(values[-min(n, 12):]))
    result.explanation = _explain(method, result, n)
    result.reorder = _reorder_recommendation(medicine, means, resid_std)
    return result


def _explain(method: str, r: ForecastResult, n: int) -> str:
    names = {
        "moving_average": "moving average of recent weeks",
        "holt_linear_trend": "Holt linear-trend exponential smoothing",
        "holt_winters": "Holt-Winters smoothing (trend + seasonality)",
        "linear_trend": "least-squares linear trend",
    }
    direction = ("rising" if r.trend_per_week > 0.5
                 else "falling" if r.trend_per_week < -0.5 else "stable")
    return (
        f"Forecast produced with {names.get(method, method)} using {n} weeks of "
        f"history. Recent demand averages {r.avg_weekly_demand:.0f} units/week and is "
        f"{direction} (≈{r.trend_per_week:+.1f} units/week). Week-to-week volatility is "
        f"±{r.volatility:.0f} units, which sets the 95% confidence band."
    )


def _reorder_recommendation(medicine, means: np.ndarray, resid_std: float) -> dict:
    """Compare predicted demand over the supplier lead time to current stock."""
    lead_days = medicine.default_supplier.lead_time_days if medicine.default_supplier else 2
    weekly_mean = float(np.mean(means)) if len(means) else 0.0
    lead_weeks = max(lead_days / 7.0, 0.5)
    # Cover demand over lead time + a safety buffer (1.65σ ≈ 95% service level).
    safety = 1.65 * resid_std * math.sqrt(lead_weeks)
    projected_need = weekly_mean * lead_weeks + safety
    on_hand = medicine.quantity_on_hand()
    shortfall = projected_need - on_hand

    should_order = on_hand <= medicine.reorder_level or shortfall > 0
    suggested = 0
    if should_order:
        target = max(medicine.reorder_quantity, projected_need * 4)  # ~4 weeks cover
        raw = max(target - on_hand, projected_need)
        pack = max(medicine.pack_size, 1)
        suggested = int(math.ceil(raw / pack) * pack)

    return {
        "on_hand": on_hand,
        "reorder_level": medicine.reorder_level,
        "lead_time_days": lead_days,
        "projected_lead_time_demand": round(projected_need, 1),
        "should_order": should_order,
        "suggested_order_units": suggested,
        "rationale": (
            f"Projected demand over the {lead_days}-day lead time (incl. safety stock) "
            f"is ≈{projected_need:.0f} units against {on_hand} on hand."
        ),
    }
