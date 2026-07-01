# Forecasting and Stock Intelligence

This document explains, honestly and in plain terms, what the "intelligence" in
AI Pharmacy Manager actually does. All of it lives in
`backend/apps/analytics/services.py` (plus the read-only work queue in
`backend/apps/notifications/work_queue.py`).

## What it is — and is not

- It is **explainable, deterministic operational arithmetic**: moving averages,
  date/quantity comparisons, and additive rule-based scores. Given the same data
  and date, it always produces the same result.
- It is **not** a black-box neural network, machine-learning model, or clinical
  decision system. There is no training, no external model, and no claim of
  clinical accuracy.
- Every output is an **advisory signal for human review**. Nothing is ordered,
  transferred, dispensed, or deducted automatically. Each surface carries wording
  such as *"Review before action. Human review required."*

## Moving-average reorder forecast

Estimates near-term demand from recorded stock movements.

- **History window (lookback):** 90 days by default. It sums the outbound stock
  movements (`quantity_delta < 0`) for a stock item in that window.
- **Average daily usage:** `consumed_units ÷ lookback_days` (i.e. divided by the
  full 90-day window).
- **Predicted usage:** `average_daily_usage × horizon_days` (horizon 30/60/90,
  default 30).
- **Suggested reorder:** `predicted_usage + safety_stock − current_stock`, floored
  at zero, where safety stock is the item's reorder level (or 15% of predicted
  usage if no reorder level is set). Converted to packs where a catalogue pack
  size is known.
- Each forecast line stores a plain-language explanation and the disclaimer
  *"Forecast suggestion only. Review before action. Human review required."*
- **Model version:** `baseline-1`. Fully deterministic.

## FEFO expiry logic

"FEFO" here means **First-Expiry-First-Out surfacing** — it highlights and orders
stock by expiry date; it does not automatically pick, quarantine, or dispense.

- Active batches with stock on hand are ordered by expiry date (soonest first).
- Each batch's days-to-expiry is bucketed: expired, 0–7, 8–30, 31–60, 61–90, 90+.
- **Value at risk** = the priced value of stock expiring within 30 days (and
  already expired). Unpriced stock is counted separately as units, not value.
- Entirely read-only.

## MDS (dosette) demand signal

A **deterministic** count of what upcoming dosette cycles will need versus what is
in stock. No forecasting or randomness.

- For active dosette cycles overlapping the horizon (default 28 days) that have
  not yet had stock deducted, it computes per medication line:
  `required_units = daily_dose × overlapping_days`, where the daily dose is the
  sum of the morning/lunchtime/evening/bedtime quantities.
- **Available units** = unexpired stock for the mapped stock item.
- **Shortfall** = `max(required − available, 0)`.
- It only reads and compares; it does **not** reserve, deduct, or order stock.
  (Actual stock deduction for a cycle is a separate, explicit human step on a
  CHECKED cycle.)

## Stock review scoring

The stock review queue is a **deterministic additive rules score** (0–100) that
combines the deterministic signals above. Points are added once per triggered
reason, for example:

- Low stock / stockout, near-expiry, dead/slow-moving, overstock (from the stock
  overview);
- "Mapping needed" or "MDS shortfall" (from the MDS demand signal);
- Expiry proximity (higher points the sooner a batch expires);
- "Order review" or "Low confidence" (from the latest forecast run).

The total is capped at 100 and mapped to a **risk level**: high (≥70), medium
(≥35), otherwise low. Items with no triggered reason are dropped. The score is a
prioritisation aid, not a validated metric, and every row says *"Review before
action. Human review required."*

## Transfer opportunity review

Suggests where dead/excess stock at one branch could cover recent demand at
another branch in the same group.

- A **source** qualifies if it has unexpired stock but no recent outbound usage in
  the window (default 30 days) — i.e. dead stock at that branch.
- A **destination** is another branch with recent usage of the same catalogue
  product; the branch with the highest recent usage is chosen.
- **Suggested quantity** keeps a 20% buffer at the source and is capped at the
  destination's recent usage.
- **Important:** generating suggestions only writes `TransferSuggestion` rows
  (status OPEN) and dismisses previous open ones for the same model version. It
  **never moves, adds, or deducts any stock**. Acting on a transfer is a separate
  human step, and each suggestion ends with *"Human review required before
  transfer."*
- **Model version:** `transfer-baseline-1`.

## Forecast confidence

Confidence is a **simple, hard-coded label of how much history a forecast is based
on** — not a calibrated probability or an accuracy guarantee.

- Forecast confidence is a step function of the number of outbound movements in
  the lookback window: 0 movements → 0.10; 1–2 → 0.35; 3–7 → 0.60; 8+ → 0.80.
- Those values map to labels: ≥0.75 "High confidence", ≥0.50 "Medium confidence",
  ≥0.35 "Low confidence", otherwise "Limited history".
- Transfer suggestions use a separate 3-level confidence (0.55 / 0.65 / 0.75)
  based on destination usage versus the suggested quantity.

## Human review is always required

Nothing in this system acts on its own:

- Forecasts and transfer suggestions are **records to review**, not actions.
- No purchase orders are created, no suppliers are contacted.
- No stock is moved, added, or deducted by the intelligence code.
- No dispensing is automated.
- Every intelligence endpoint is permission-gated and tenant-scoped.

## Limitations (honest)

- The forecast is a naive mean of outbound movements over a fixed 90-day window;
  dividing by the full window under-forecasts items with sparse history. There is
  no seasonality, trend, lead-time modelling, or statistical safety stock.
- "Confidence" values are arbitrary step functions of a count/ratio, not
  calibrated probabilities or accuracy measures.
- Usage depends on stock movements being recorded consistently; if outbound
  movements are missed, demand and dead-stock flags can be wrong.
- Scores are hand-tuned additive weights capped at 100, with no validation;
  overlapping signals can compound.
- Transfer matching requires both branches to share the same catalogue product
  and ignores the destination's own on-hand stock and expiry; MDS availability is
  not reserved, so the same stock can appear available to more than one demand
  row.
- Regenerating transfer suggestions dismisses prior open ones, discarding earlier
  triage state. There is no accuracy backtest anywhere.

These are deliberate, documented simplifications appropriate to a prototype over
fictional demo data. They are candidates for future work, not hidden behaviour.

## Key files

- `backend/apps/analytics/services.py` — all forecasting, expiry, MDS, scoring,
  and transfer logic.
- `backend/apps/analytics/models.py` — `ForecastRun`, `ForecastItem`,
  `TransferSuggestion`.
- `backend/apps/analytics/views.py` — read-only, permission-gated endpoints.
- `backend/apps/notifications/work_queue.py` — the read-only "needs attention"
  work queue that re-surfaces these signals.
