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

A unified platform built around the real community-pharmacy dosette workflow, with ten core modules:

| Module | Highlights |
|---|---|
| **Authentication & security** | JWT access/refresh tokens, role-based access control (Administrator / Pharmacist / Dispenser), PBKDF2 password hashing, protected routes, immutable **audit log** of every significant action. |
| **Dashboard** | Headline KPIs, 90-day dispensing trend, expiry exposure, predicted shortages, recent activity — with professional charts. |
| **Patient management** | Pseudo-anonymised records, demographics, allergy notes, simulated GP/prescriber info, special instructions, active/inactive status, search, filtering and patient history. |
| **Dosette management** | Weekly & monthly compliance packs, day × time-slot schedules (Morning/Afternoon/Evening/Bedtime), cycle generation with proactive **due dates**, dosage review tracking, printable per-patient pack summaries, and the signature day × slot pack-grid visualisation. |
| **Picking lists** | Auto-aggregated weekly requirements across all active plans, per-line completion tracking, shortfall flags and **PDF export**. |
| **Stock management** | Medicines, pack sizes, manufacturers, suppliers, batches, expiry dates, **FEFO allocation**, stock adjustments, wastage recording and an append-only movement ledger. |
| **Expiry management** | 1/3/6-month expiry windows, FEFO heat scale, expired-stock alerts. |
| **AI forecasting** | Explainable time-series demand forecasting (Holt-Winters → Holt trend → moving-average, with graceful fallback), 95% confidence intervals, reorder recommendations with rationale. |
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
| Database | **PostgreSQL** (SQLite for zero-config local dev) | Relational integrity for batches/movements/schedules; indices for FEFO and expiry queries. |
| Forecasting | **numpy + statsmodels** (scikit-learn available) | Statistically defensible, explainable methods; **degrades gracefully** to a NumPy linear trend if statsmodels is unavailable. |
| Reporting | **ReportLab** | Server-side PDF generation; CSV via the standard library. |
| Packaging | **Docker + docker-compose** | One-command reproducible stack (db + redis + api + web). |
| Testing | **pytest + pytest-django + DRF APIClient** | Unit + API tests across FEFO, RBAC, forecasting and dosette logic. |

Full reasoning, trade-offs and rejected alternatives are in
[`docs/technical-justification.md`](docs/technical-justification.md).

## Quick start (Docker)

Prerequisites: Docker + Docker Compose.

```bash
git clone https://github.com/alvinsakhiya/Ai-Pharmacy-Manager.git
cd Ai-Pharmacy-Manager
docker compose up --build
```

This starts PostgreSQL, Redis, the API and the web app. On first boot the backend automatically
runs migrations and **seeds realistic demo data**.

- Web app: <http://localhost:8080>
- API docs (Swagger): <http://localhost:8000/api/docs/>
- Django admin: <http://localhost:8000/admin/>

## Local development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # SQLite by default — no DB setup needed
python manage.py migrate
python manage.py seed                                 # generate demo data
python manage.py createsuperuser                      # optional, for /admin
python manage.py runserver                            # http://localhost:8000
```

> The supported backend runtime is Python **3.14** with Django **6.0**.

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

Generates 200+ pseudo-anonymised patients, 60+ medicines, suppliers/manufacturers, stock batches
with a realistic expiry mix, weekly/monthly dosette plans, ~18 months of daily usage history
(trend + seasonality + noise) for the forecasting engine, an initial picking list and notifications.

## Testing

```bash
cd backend
pytest                 # FEFO, RBAC/auth, forecasting, dosette & picking
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
│       ├── stock/           # medicines, suppliers, FEFO batches, movements, usage
│       ├── dosette/         # plans, items, cycles, due dates
│       ├── picking/         # picking lists & generation
│       ├── forecasting/     # explainable forecasting engine
│       ├── notifications/   # alert generation & centre
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
- [Roadmap & future enhancements](docs/roadmap.md)

## Roadmap

Highlights (full list in [`docs/roadmap.md`](docs/roadmap.md)): barcode/2D-scan accuracy checks,
Celery/Redis background jobs for nightly forecasting & alerting, configurable safety-stock service
levels, multi-site inventory, label printing, and a model-evaluation harness (MAPE/RMSE backtesting)
for the forecasting module.

---

*Built as an original academic project. Not affiliated with, connected to, or endorsed by any
healthcare authority. Simulated data only.*
