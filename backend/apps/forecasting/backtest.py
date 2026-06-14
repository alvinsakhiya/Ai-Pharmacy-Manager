"""Model-evaluation harness for the demand-forecasting engine.

The forecasting engine (`engine.py`) *selects* a method automatically from the
amount of history available. This module answers the complementary, evaluative
question that the project title asks — *how good is that forecast?* — by running
**rolling-origin (walk-forward) backtesting** and reporting standard, reportable
accuracy metrics per method.

Why rolling-origin rather than a single hold-out split:
    A single train/test split gives one error estimate from one arbitrary cut of
    history. Rolling-origin re-fits the model at every successive week, forecasts
    one step ahead, and records the error — yielding many out-of-sample errors and
    a far more stable estimate of real forecasting skill. It is the standard
    evaluation protocol for time-series methods (Hyndman & Athanasopoulos, *FPP*).

Metrics (all computed over the same set of out-of-sample origins so methods are
directly comparable):
    MAE   — mean absolute error (units).
    RMSE  — root mean squared error (units); penalises large misses.
    MAPE  — mean absolute percentage error (%); scale-free but undefined at zero
            demand, so it is reported only over non-zero actuals (with coverage).
    MASE  — mean absolute scaled error; MAE scaled by the in-sample one-step naive
            MAE. MASE < 1 means the method beats a naive "repeat last week"
            forecast on the training data. Scale-free *and* defined at zero demand,
            so it is the headline metric for ranking.

Every candidate method is also compared against two transparent baselines — the
naive (last value) and seasonal-naive (value one season ago) forecasts — and a
**skill score** (1 − RMSE_method / RMSE_naive) makes "is the model earning its
complexity?" an explicit, reportable number.

statsmodels is used when available and degrades to the NumPy fallbacks exactly as
the live engine does, so the backtest reflects what the engine would actually do.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field

import numpy as np

from .engine import SEASONAL_PERIODS, _HAS_SM, _weekly_series, forecast_medicine

# Need enough history to leave a meaningful out-of-sample tail after seeding the
# first fit. Two seasonal cycles lets the seasonal methods initialise.
MIN_TRAIN_WEEKS = max(8, 2 * SEASONAL_PERIODS)
MIN_HISTORY_WEEKS = MIN_TRAIN_WEEKS + 4  # at least 4 evaluation folds

# Evaluate at most the most-recent N origins. Each fold re-fits every method
# (statsmodels MLE is the dominant cost), so an unbounded walk over years of
# weekly history is needlessly slow; ~26 recent folds (half a year) give a
# statistically stable error estimate while keeping the endpoint responsive, and
# weighting recent history better reflects the current demand regime.
MAX_FOLDS = 26


# --- candidate one-step forecasters --------------------------------------------
# Each takes the training history (1-D float array, length >= 1) and returns a
# single next-step point prediction (clipped at zero — demand is non-negative).

def _f_naive(train: np.ndarray) -> float:
    return float(train[-1])


def _f_seasonal_naive(train: np.ndarray) -> float:
    if len(train) >= SEASONAL_PERIODS:
        return float(train[-SEASONAL_PERIODS])
    return float(train[-1])


def _f_moving_average(train: np.ndarray) -> float:
    recent = train[-min(len(train), 4):]
    return float(np.mean(recent))


def _f_linear_trend(train: np.ndarray) -> float:
    n = len(train)
    if n < 2:
        return float(train[-1])
    x = np.arange(n)
    a, b = np.polyfit(x, train, 1)
    return max(0.0, float(a * n + b))


def _f_holt(train: np.ndarray) -> float:
    if _HAS_SM and len(train) >= 4:
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing

            fit = ExponentialSmoothing(
                train, trend="add", damped_trend=True,
                initialization_method="estimated",
            ).fit(optimized=True)
            return max(0.0, float(np.asarray(fit.forecast(1))[0]))
        except Exception:
            pass
    return _f_linear_trend(train)


def _f_holt_winters(train: np.ndarray) -> float:
    if _HAS_SM and len(train) >= 2 * SEASONAL_PERIODS:
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing

            fit = ExponentialSmoothing(
                train, trend="add", damped_trend=True,
                seasonal="add", seasonal_periods=SEASONAL_PERIODS,
                initialization_method="estimated",
            ).fit(optimized=True)
            return max(0.0, float(np.asarray(fit.forecast(1))[0]))
        except Exception:
            pass
    return _f_holt(train)


# Ordered so baselines render first in the UI; `is_baseline` drives skill scoring.
CANDIDATES = [
    ("naive", "Naive (last week)", _f_naive, True),
    ("seasonal_naive", "Seasonal naive", _f_seasonal_naive, True),
    ("moving_average", "Moving average", _f_moving_average, False),
    ("linear_trend", "Linear trend", _f_linear_trend, False),
    ("holt_linear_trend", "Holt linear trend", _f_holt, False),
    ("holt_winters", "Holt-Winters (seasonal)", _f_holt_winters, False),
]


@dataclass
class MethodScore:
    method: str
    label: str
    is_baseline: bool
    mae: float
    rmse: float
    mape: float | None
    mape_coverage: float
    mase: float | None
    skill_vs_naive: float | None


@dataclass
class BacktestResult:
    medicine_id: int
    medicine_label: str = ""
    folds: int = 0
    train_window_weeks: int = MIN_TRAIN_WEEKS
    history_weeks: int = 0
    engine_method: str = ""
    best_method: str | None = None
    methods: list[MethodScore] = field(default_factory=list)
    insufficient_history: bool = False
    explanation: str = ""

    def as_dict(self) -> dict:
        return {
            "medicine_id": self.medicine_id,
            "medicine_label": self.medicine_label,
            "folds": self.folds,
            "train_window_weeks": self.train_window_weeks,
            "history_weeks": self.history_weeks,
            "engine_method": self.engine_method,
            "best_method": self.best_method,
            "insufficient_history": self.insufficient_history,
            "min_history_weeks": MIN_HISTORY_WEEKS,
            "methods": [
                {k: (round(v, 3) if isinstance(v, float) else v)
                 for k, v in asdict(m).items()}
                for m in self.methods
            ],
            "explanation": self.explanation,
        }


def _naive_scale(values: np.ndarray) -> float:
    """In-sample one-step naive MAE — the MASE denominator. Guard against a flat
    series (all-equal) where the scale would be zero."""
    if len(values) < 2:
        return 1.0
    return float(np.mean(np.abs(np.diff(values)))) or 1.0


def backtest_medicine(medicine, min_train: int = MIN_TRAIN_WEEKS) -> BacktestResult:
    """Rolling-origin one-step-ahead backtest across all candidate methods."""
    _, values = _weekly_series(medicine)
    label = getattr(medicine, "label", str(medicine.id))
    result = BacktestResult(medicine_id=medicine.id, medicine_label=label,
                            train_window_weeks=min_train,
                            history_weeks=len(values))

    if len(values) < MIN_HISTORY_WEEKS:
        result.insufficient_history = True
        result.explanation = (
            f"Backtesting needs at least {MIN_HISTORY_WEEKS} weeks of history "
            f"(to leave a meaningful out-of-sample tail); this medicine has "
            f"{len(values)}. Showing the live forecast only."
        )
        return result

    # Forecast values[t] from values[:t]; keep only the most-recent MAX_FOLDS.
    origins = list(range(min_train, len(values)))[-MAX_FOLDS:]
    result.folds = len(origins)
    scale = _naive_scale(values)

    # errors[method] -> list of (signed_error, actual)
    errors: dict[str, list[tuple[float, float]]] = {k: [] for k, *_ in CANDIDATES}
    for t in origins:
        train = values[:t]
        actual = float(values[t])
        for key, _label, fn, _base in CANDIDATES:
            pred = fn(train)
            errors[key].append((pred - actual, actual))

    rmse_naive = _rmse([e for e, _ in errors["naive"]])
    scores: list[MethodScore] = []
    for key, label_, fn, is_base in CANDIDATES:
        errs = errors[key]
        abs_err = [abs(e) for e, _ in errs]
        rmse = _rmse([e for e, _ in errs])
        # MAPE only over non-zero actuals (it is undefined / explosive at zero).
        pct = [abs(e) / a for e, a in errs if a > 0]
        mape = (100.0 * float(np.mean(pct))) if pct else None
        scores.append(MethodScore(
            method=key, label=label_, is_baseline=is_base,
            mae=float(np.mean(abs_err)),
            rmse=rmse,
            mape=mape,
            mape_coverage=round(len(pct) / len(errs), 3) if errs else 0.0,
            mase=(float(np.mean(abs_err)) / scale) if scale else None,
            skill_vs_naive=(1.0 - rmse / rmse_naive) if rmse_naive else None,
        ))

    result.methods = scores
    # Rank real (non-baseline) methods by MASE; fall back to any method.
    rankable = [s for s in scores if not s.is_baseline and s.mase is not None]
    best = min(rankable or scores, key=lambda s: (s.mase if s.mase is not None else math.inf))
    result.best_method = best.method

    engine_result = forecast_medicine(medicine, 4)
    result.engine_method = engine_result.method
    result.explanation = _explain(result, best, scale)
    return result


def _rmse(signed_errors: list[float]) -> float:
    arr = np.asarray(signed_errors, dtype=float)
    return float(np.sqrt(np.mean(arr ** 2))) if len(arr) else 0.0


def _explain(result: BacktestResult, best: MethodScore, scale: float) -> str:
    skill = best.skill_vs_naive
    verdict = (
        "beating" if best.mase is not None and best.mase < 1
        else "no better than"
    )
    skill_txt = (
        f" ({skill * 100:+.0f}% RMSE skill versus the naive baseline)"
        if skill is not None else ""
    )
    agree = (
        "matches" if best.method == result.engine_method
        else "differs from"
    )
    return (
        f"Rolling-origin backtest over {result.folds} one-step-ahead folds "
        f"(re-fitting after each week). Best method: {best.label}, MASE "
        f"{best.mase:.2f} — {verdict} a naive last-week forecast{skill_txt}. "
        f"This {agree} the method the live engine auto-selects "
        f"({result.engine_method}). Lower MASE/RMSE is better; MASE < 1 beats naive."
    )
