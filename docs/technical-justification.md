# Technical Justification

This document records the significant engineering decisions, the alternatives considered, and the
reasoning — as expected for a final-year dissertation.

## 1. Decoupled SPA + REST API (vs. server-rendered Django templates)

**Decision:** React SPA talking to a DRF JSON API.
**Why:** A pharmacy tool is used intensively for whole shifts; rich client-side interactivity
(optimistic updates, instant filtering, the dosette pack grid, live charts) is far smoother in a
SPA than with full page reloads. Decoupling also lets the API be reused by future clients (label
printers, mobile) and scaled independently.
**Trade-off:** Two build pipelines and CORS/JWT handling. Accepted because the UX gain is central to
the project's thesis (unifying fragmented, clunky workflows into one *fluid* product).

## 2. Django REST Framework (vs. FastAPI / Node-NestJS)

**Decision:** Django REST Framework.
**Why:** The project is dominated by relational CRUD with strong invariants (batches, movements,
schedules), RBAC, auditing and an admin surface — exactly Django's strengths. The ORM + migrations
give safe schema evolution; the admin accelerates data inspection during development; the
forecasting engine sits in the same Python process as the data with no service hop.
**Alternatives:** FastAPI is leaner and async-first but would require assembling auth, ORM, admin and
migrations from parts. Node/NestJS gives shared TS types but pushes forecasting into a separate
Python service or weaker JS libraries. DRF was the lowest-risk, highest-leverage choice for the
breadth of modules required.

## 3. PostgreSQL in every environment

**Decision:** PostgreSQL is required for Docker, local development, CI and production.
**Why:** PostgreSQL gives the relational integrity and indexing the FEFO/expiry queries need.
Running the same database engine everywhere also prevents SQLite/PostgreSQL differences in
constraints, transactions, data types and query behaviour from escaping local tests. Docker
Compose still keeps setup to one command, so this consistency does not add manual database
installation work.

## 4. Batch-level inventory & FEFO as a service

**Decision:** Quantities live on `StockBatch`; `fefo_allocate()` is a pure service with a `commit`
flag; movements are an append-only ledger.
**Why:** FEFO (First-Expired-First-Out) is the real rotation principle and only makes sense at batch
granularity. A pure, dry-runnable allocation function is unit-testable and reusable by picking,
dispensing and previews. An append-only ledger gives traceability and makes stock reconstructable.

## 5. Explainable, fallback-safe forecasting

**Decision:** Automatic method selection (moving-average → Holt → Holt-Winters) on a weekly series,
with NumPy linear-trend fallback, 95% CIs, and a generated natural-language explanation + reorder
rationale.
**Why:** The brief asks for *explainability, confidence levels and reorder recommendations* for
**academic demonstration, not clinical decision-making**. Classical, transparent time-series methods
are defensible and interpretable, unlike an opaque ML model on limited synthetic data. Graceful
fallback means the API works even if `statsmodels` is absent, which improves robustness and
reproducibility. Safety stock uses a service-level (≈95%, z≈1.65) buffer over the supplier lead time
— a standard, citable inventory formula.
**Trade-off:** No deep-learning model. Justified: with simulated data and an explainability
requirement, sophistication would add opacity without academic value. A backtesting/MAPE harness is
on the roadmap to *evaluate* the chosen methods quantitatively.

## 6. Centralised RBAC + explicit audit actors

**Decision:** A reusable `RolePermission` reading `allowed_roles`/`read_roles` off each ViewSet, plus
explicit authenticated actors passed to `audit.record()`.
**Why:** Keeps authorisation declarative and consistent across ~30 endpoints, and lets the
audit trail reliably attribute JWT-authenticated actions. Safety-critical operations (pack final
check) get a dedicated stricter permission.

## 7. Design-token system in Tailwind

**Decision:** Encode the entire visual language (colour, type scale, spacing, radius, shadow, motion,
FEFO heat scale) as Tailwind theme tokens; build a small house component library once.
**Why:** A coherent, dense, calm-but-alive clinical UI requires every surface to draw from one token
set. Centralising tokens prevents per-screen drift and makes the "Apple-calm + fluid-feedback"
character consistent and maintainable.

## 8. Docker Compose for reproducibility

**Decision:** One `docker compose up` provisions db + redis + api + web, auto-migrating and seeding.
**Why:** A dissertation artefact must be trivially reproducible by a marker. Redis is included now to
make the documented background-jobs roadmap a configuration change rather than a re-architecture.

## Known limitations (honest appraisal)

- Forecasting accuracy is illustrative on synthetic data; quantitative evaluation (backtesting) is
  future work.
- No barcode/2D-scan accuracy step yet (modelled in the workflow, on the roadmap).
- Notifications are generated on demand / on login rather than by a scheduler (Celery/Redis on the
  roadmap).
- Single-pharmacy scope; multi-site is a deliberate future enhancement.
