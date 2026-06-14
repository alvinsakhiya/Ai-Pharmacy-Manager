# Pharmacy Manager — AI-Enhanced Pharmacy Stock Optimisation & Patient Dosette Management System

> **Design and Evaluation of an AI-Enhanced Pharmacy Stock Optimisation and Patient Dosette Management System**
> Final-year computing project — a production-quality prototype demonstrating how fragmented UK
> community-pharmacy workflows (dosette/MDS preparation, stock control, forecasting and reporting)
> can be unified within a single intelligent platform.

> ⚠️ **Academic prototype.** Uses **simulated, pseudo-anonymised data only**. It does **not** integrate
> with any external healthcare system, prescription service, or real patient records. It is **not for
> clinical use**.

---

## Table of contents

- [What it does](#what-it-does)
- [Screens](#screens)
- [Architecture](#architecture)
- [Tech stack & justification](#tech-stack--justification)
- [Quick start (Docker)](#quick-start-docker)
- [Local development](#local-development)
- [Demo accounts](#demo-accounts)
- [Seed data](#seed-data)
- [Testing](#testing)
- [API documentation](#api-documentation)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Roadmap](#roadmap)

---

## What it does

A unified platform built around the real community-pharmacy dosette workflow, with these core modules:

| Module | Highlights |
|---|---|
| **Authentication & security** | JWT access/refresh tokens, role-based access control (Administrator / Pharmacist / Dispenser), PBKDF2 password hashing, protected routes, immutable **audit log** of every significant action. |
| **Dashboard** | Headline KPIs, 90-day dispensing trend, expiry exposure, predicted shortages, recent activity — with professional charts. |
| **Patient management** | PostgreSQL-backed pseudo-anonymised demographics, notes, role-scoped list/search APIs and active/inactive status. A top-bar patient search reaches any record by name, initials, DOB, postcode, ID — and **similar spellings** (phonetic + edit-distance), mirroring a real Find-Patient picker that never auto-opens the first match. The richer medication-history record remains an explicitly simulated portfolio workflow pending API integration. |
| **Dispensing workspace** | Compact item-by-item prescription entry with a persistent patient context, selectable item list, explicit warning acknowledgement, printable simulated labels and a keyboard-operated **trusted-directions** picker. The approved phrase library is PostgreSQL-backed and searchable by shortcut code or wording; it speeds up typing but never replaces human verification. |
| **Dosette management** | Weekly & monthly compliance packs, day × time-slot schedules (Morning/Afternoon/Evening/Bedtime), cycle generation with proactive **due dates**, dosage review tracking, printable per-patient pack summaries, and the signature day × slot pack-grid visualisation. |
| **Dispensing pipeline board** | Store-wide [workflow board](docs/pipeline-board.md) — every job (prescription / dosette / stock issue) across all patients grouped into status columns (New → Picking → Accuracy check → Ready → Collected, or Issue), with priority/overdue badges, **role-gated** transitions (pharmacist-only accuracy check), assignment, an audited status history, and **explainable AI prompts** (overdue, stock/expiry, due-soon, needs-pharmacist) with confidence scores. |
| **Picking lists** | Auto-aggregated weekly requirements across all active plans, per-line completion tracking, shortfall flags and **PDF export**. |
| **Stock management** | Medicines, pack sizes, manufacturers, suppliers, batches, expiry dates, **FEFO allocation**, stock adjustments, wastage recording and an append-only movement ledger. |
| **Expiry management** | 1/3/6-month expiry windows, FEFO heat scale, expired-stock alerts. |
| **AI forecasting** | Explainable time-series demand forecasting (Holt-Winters → Holt trend → moving-average, with graceful fallback), 95% confidence intervals, reorder recommendations with rationale, and a **rolling-origin model-evaluation harness** (MAE/RMSE/MAPE/MASE per method vs naive baselines, with a skill score) surfaced as the **Model accuracy** panel — so method selection is evidence-based, not assumed. |
| **AI decision support showcase** | Explainable safety prompts, intake parsing, daily priorities and reorder/waste suggestions. These screens clearly identify deterministic simulated data until dedicated `/api/ai/*` services are implemented; human review is always required. |
| **Notification centre** | Low stock, approaching expiry, predicted shortages, overdue reviews and announcements — idempotently regenerated. |
| **Reporting** | Stock valuation, expiry, low-stock, dosette workload, forecasting and patient-summary reports with **PDF & CSV export**. |

## Screens

The frontend is a modern healthcare-product UI — calm, dense, professional surfaces (the "Apple
pro-tool" posture) with fluid motion and clear feedback. The design system (colour, type, spacing,
motion, FEFO expiry heat scale) is encoded directly in [`frontend/tailwind.config.js`](frontend/tailwind.config.js).

A visual preview gallery is described in [`docs/ui-previews.md`](docs/ui-previews.md).

## Architecture

A decoupled SPA + REST API. See [`docs/architecture.md`](docs/architecture.md) for the full diagram
and component breakdown, and [`docs/er-diagram.md`](docs/er-diagram.md) for the data model.

```
React (Vite + Tailwind)  ──HTTPS/JSON──▶  Django REST Framework API  ──▶  PostgreSQL
        SPA                JWT auth            (8 domain apps)              (FEFO, audit,
   nginx (prod)                            forecasting engine               usage history)
                                            (numpy / statsmodels)
```

## Tech stack & justification

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React + Vite + Tailwind + React Router + Recharts + Lucide** | Fast DX, a strict design-token system for a coherent clinical UI, route-based views, professional charting. |
| Backend | **Django REST Framework** | Batteries-included auth, ORM, migrations and admin; RBAC and audit are natural; the forecasting engine lives in the same Python runtime as the data. |
| Database | **PostgreSQL 18** | One database engine in development, testing and deployment prevents engine-specific behaviour from being missed; PostgreSQL provides strong relational integrity and indexing for FEFO and expiry queries. |
| Forecasting | **numpy + statsmodels** (scikit-learn available) | Statistically defensible, explainable methods; **degrades gracefully** to a NumPy linear trend if statsmodels is unavailable. |
| Reporting | **ReportLab** | Server-side PDF generation; CSV via the standard library. |
| Packaging | **Docker + Docker Compose + pgAdmin** | One-command reproducible stack with PostgreSQL-only persistence and a preconfigured database dashboard. |
| Testing | **pytest + pytest-django + DRF APIClient + Vitest/Testing Library** | Backend business/API tests plus focused frontend keyboard and modal-accessibility tests. |

Full reasoning, trade-offs and rejected alternatives are in
[`docs/technical-justification.md`](docs/technical-justification.md).

## Quick start (Docker)

Prerequisites: Docker + Docker Compose.

```bash
git clone https://github.com/alvinsakhiya/Ai-Pharmacy-Manager.git
cd Ai-Pharmacy-Manager
cp .env.example .env
docker compose up --build -d
docker compose ps
```

This starts PostgreSQL, pgAdmin, Redis, the API and the web app. On first boot the backend
automatically runs migrations and **seeds realistic demo data**. pgAdmin is preconfigured with the
project database.

- Web app: <http://localhost:8080>
- API docs (Swagger): <http://localhost:8000/api/docs/>
- Django admin: <http://localhost:8000/admin/>
- pgAdmin: <http://localhost:5050> (`admin@example.com` / `PgAdmin123!`)

In pgAdmin, expand **AI Pharmacy Manager → AI Pharmacy PostgreSQL → Databases → pharmacy**. The
database password is supplied automatically from the same `.env` value used by PostgreSQL.

Useful Docker commands:

```bash
docker compose logs -f backend                         # follow backend startup/logs
docker compose logs -f pgadmin                         # follow pgAdmin startup/logs
docker compose exec backend python manage.py seed     # seed again (idempotent)
docker compose exec backend python manage.py createsuperuser
docker compose exec backend pytest                    # run backend tests on PostgreSQL
docker compose stop                                   # stop without deleting data
docker compose down                                   # remove containers; keep database volume
docker compose down --volumes                         # destructive: also delete database data
```

PostgreSQL data is stored in the named `pgdata18` volume, while pgAdmin settings use the
`pgadmin_data` volume. Both survive normal container restarts and `docker compose down`. The
application intentionally has no SQLite fallback.

## Local development

### Backend

Start only PostgreSQL in Docker, then run Django on the host:

```bash
cp .env.example .env                                  # from the repository root
docker compose up -d db
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed                                 # generate demo data
python manage.py createsuperuser                      # optional, for /admin
python manage.py runserver                            # http://localhost:8000
```

> The supported backend runtime is Python **3.14** with Django **6.0**. `DATABASE_URL` is mandatory
> and must point to PostgreSQL. For the command above it is
> `postgresql://pharma:pharma@localhost:5433/pharmacy`.

### Frontend

```bash
cd frontend
npm ci
npm run dev                                           # http://localhost:5173 (proxies /api to :8000)
```

## Demo accounts

Seeded automatically. Password for all: **`Password123!`**

| Role | Username | Can do |
|---|---|---|
| Administrator | `admin` | Everything, incl. user management & configuration |
| Pharmacist | `pharmacist` | Clinical & final checks, full operational access, audit log |
| Dispenser | `dispenser` | Picking, pack assembly, stock movements (read-only on records) |

## Seed data

```bash
python manage.py seed              # ~220 patients, 65 medicines, batches, plans, 18 months usage
python manage.py seed --flush      # wipe domain data first, then reseed
```

Generates 200+ pseudo-anonymised patients, 60+ medicines, an original trusted-directions library, suppliers/manufacturers, stock batches
with a realistic expiry mix, weekly/monthly dosette plans, ~18 months of daily usage history
(trend + seasonality + noise) for the forecasting engine, an initial picking list and notifications.

## Testing

```bash
cd backend
pytest                 # FEFO, RBAC/auth, patient search, trusted directions, forecasting, dosette & picking

cd ../frontend
npm run lint
npm test               # shared component accessibility/keyboard tests
npm run build
```

The test strategy is documented in [`docs/testing.md`](docs/testing.md).

## API documentation

Interactive OpenAPI/Swagger UI is served at `/api/docs/` (ReDoc at `/api/redoc/`, raw schema at
`/api/schema/`). A hand-written endpoint reference is in [`docs/api.md`](docs/api.md).

## Project structure

```
Ai-Pharmacy-Manager/
├── backend/                 # Django REST Framework API
│   ├── config/              # settings, urls, wsgi/asgi
│   └── apps/
│       ├── core/            # base models, audit log, RBAC, middleware, seed command
│       ├── accounts/        # custom user, JWT auth, RBAC, audit API
│       ├── patients/        # patient records & history
│       ├── directions/      # staff-approved label phrase lookup
│       ├── stock/           # medicines, suppliers, FEFO batches, movements, usage
│       ├── dosette/         # plans, items, cycles, due dates
│       ├── picking/         # picking lists & generation
│       ├── forecasting/     # explainable forecasting engine
│       ├── notifications/   # alert generation & centre
│       ├── workflow/        # dispensing pipeline and audited transitions
│       └── reports/         # dashboard, PDF/CSV reports
├── frontend/                # React + Vite + Tailwind SPA
│   └── src/{api,components,context,hooks,pages,lib}
├── docs/                    # architecture, ER diagram, API, justification, roadmap
└── docker-compose.yml
```

## Documentation

- [Architecture & component design](docs/architecture.md)
- [ER diagram & data model](docs/er-diagram.md)
- [API reference](docs/api.md)
- [Technical justification](docs/technical-justification.md)
- [Testing strategy](docs/testing.md)
- [UI previews](docs/ui-previews.md)
- [Deployment guide](docs/deployment.md)
- [Engineering audit (13 June 2026)](docs/audit-2026-06-13.md)
- [Real-world pharmacy workflow & UX analysis](docs/screenshot-workflow-analysis.md)
- [Screenshot inventory (154 screens)](docs/screenshot-inventory.md) · [grouped workflow analysis](docs/real-world-workflow-analysis.md) · [implementation plan](docs/screenshot-implementation-plan.md)
- [Dispensing pipeline board](docs/pipeline-board.md)
- [Roadmap & future enhancements](docs/roadmap.md)

## Roadmap

Highlights (full list in [`docs/roadmap.md`](docs/roadmap.md)): barcode/2D-scan accuracy checks,
Celery/Redis background jobs for nightly forecasting & alerting, configurable safety-stock service
levels, multi-site inventory and label printing. The model-evaluation harness (rolling-origin
MAPE/RMSE/MASE backtesting) for the forecasting module is **now implemented** — see the Model accuracy
panel on the Forecasting screen.

---

*Built as an original academic project. Not affiliated with, connected to, or endorsed by any
healthcare authority. Simulated data only.*
