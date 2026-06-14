# Roadmap & Future Enhancements

Prioritised enhancements that would take the prototype toward a deployable product, grouped by theme.
Each is framed so it can be discussed as "future work" in a dissertation.

## Near-term (high value, low risk)

1. **Barcode / 2D-matrix accuracy check.** Implement the scan-verification safety step modelled in
   the workflow: scan picked stock against the expected item, with an unambiguous pass/fail screen.
2. **Background jobs (Celery + Redis).** Move notification generation and nightly forecasting off the
   request path; schedule a daily "alerts + reorder" digest. (Redis is already provisioned.)
3. **Configurable safety-stock service levels.** Expose the z-value / target weeks-of-cover per
   medicine or category instead of the fixed ≈95% assumption.
4. **Stock receipt against purchase orders.** Generate POs from reorder recommendations and reconcile
   deliveries into batches.

## Forecasting maturity

5. ✅ **Model-evaluation harness — implemented.** Rolling-origin (walk-forward) backtesting reporting
   MAE / RMSE / MAPE / MASE per method against naive and seasonal-naive baselines, with a skill score,
   so method selection is *evidence-based* and reportable — directly supporting the "Evaluation" half
   of the project title. Engine in [`backend/apps/forecasting/backtest.py`](../backend/apps/forecasting/backtest.py),
   exposed at `GET /api/forecast/medicine/<id>/backtest/` and surfaced as the **Model accuracy** panel
   on the Forecasting screen. *Next:* multi-step (h-week) horizons and a cross-medicine accuracy summary.
6. **Promotional / seasonal regressors & intermittent-demand models** (e.g. Croston's method) for
   slow-moving lines.
7. **Per-medicine method override & confidence tuning** surfaced in the UI.

## Workflow depth

8. **Label printing** for monthly compliance packs — day × time-slot layout in plain language.
9. **Full dispensing pipeline states** (token print → label → pick → scan → assemble → final check →
   seal) as a tracked, audited state machine with role gating at each step.
10. **Patient-facing pack summaries** (printable PDF medication schedule).

## Platform & operations

11. **Multi-site / multi-branch inventory** with stock transfers and per-site reorder levels.
12. **Refresh-token blacklisting & session management**; optional 2FA for pharmacists.
13. **Observability** — structured logging, metrics, error tracking; health/readiness probes.
14. **CI/CD** — GitHub Actions running pytest + frontend build/lint on every PR; container image
    publishing.
15. **Accessibility audit** to WCAG 2.2 AA and keyboard-only operability pass.

## Data & integration (out of current scope by design)

16. Real prescription-intake integration is **explicitly excluded** from this academic prototype.
    A future productionised version would integrate via appropriate, authorised channels — but that
    is outside the remit and constraints of this project.
