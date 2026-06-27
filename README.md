# AI-Enhanced Pharmacy Stock Optimisation and Patient Dosette Management System

An academic final-year prototype for pharmacy stock optimisation and patient
Dosette/MDS workflow support. The system combines stock, batch, movement,
patient, Dosette/MDS, analytics, reporting, alerts, and pharmacist review
workflows in a single role-based web application.

This project uses fictional demo data only. It does not integrate with NHS
systems, does not use real patient data, does not perform clinical
decision-making, and does not provide diagnosis, automated recommendations, or
compliance guarantees.

## Implemented Phase 2 Modules

| Module | Name | Implemented capability | Evidence areas |
| --- | --- | --- | --- |
| 5 | Medication catalogue | Tenant-scoped medication master records with backend API and frontend management UI. | `apps/catalogue`, `/catalogue`, frontend medication tests |
| 6 | Inventory, stock, batches, movements, transfers | Stock items, batches, receiving, adjustment, count reconciliation, transfer, and append-only movement history. | `apps/inventory`, `/inventory`, inventory tests and E2E |
| 7 | Patient records, notes, encryption | Patient records, encrypted PII fields, blind-index search, patient notes, scoped frontend views. | `apps/patients`, `/patients`, patient tests and E2E |
| 8 | Dosette/MDS | Patient medication lines, Dosette/MDS cycles, preparation workflow, picking list. | `apps/blister`, `/patients/:id/dosette`, Dosette tests and E2E |
| 9 | Stock-aware Dosette/MDS preview | Stock preview with availability, shortages, and FEFO batch suggestions. | Stock preview endpoints and Dosette UI |
| 10 | Dosette/MDS stock deduction | Safe stock deduction for prepared cycles with append-only `BLISTER_DEDUCTION` movements and cancellation guard after deduction. | Deduct-stock endpoint, StockMovement history, E2E smoke |
| 11 | Stock Intelligence analytics | Read-only stock attention analytics for stockout, low stock, expiry, dead-stock, and slow-moving indicators. | `apps/analytics`, `/analytics`, analytics tests and E2E |
| 12 | Reports and CSV exports | Stock attention and stock movement reports with authenticated JSON and CSV export paths. | `apps/reports`, `/reports`, report tests and E2E |
| 13 | Notifications and alerts | Live-computed operational stock and Dosette/MDS alerts with severity/category summaries. | `apps/notifications`, `/alerts`, alert tests and E2E |
| 14 | Pharmacist review workflow | Operational review queue, patient review section, create/complete/cancel workflow, encrypted notes, audit-backed mutations. | `apps/reviews`, `/reviews`, review tests and E2E |

## Tech Stack

- Django 5 and Django REST Framework
- PostgreSQL
- React, TypeScript, and Vite
- Tailwind CSS
- TanStack Query
- Playwright
- GitHub Actions
- Docker Compose for local development
- Ruff, mypy, pytest, ESLint, Vitest, and pre-commit for quality checks

## Local Setup

Prerequisites: Python 3.12+, Node.js 22+, npm, and PostgreSQL.

Create local environment settings:

```bash
cp .env.example .env
```

Backend setup:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Frontend setup in another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The development frontend runs at `http://localhost:5173`. The API runs at
`http://localhost:8000`, with a health endpoint at
`http://localhost:8000/api/health/`.

For local development outside Docker, update `DATABASE_URL` in `.env` so its
hostname points to your PostgreSQL server, usually `localhost`.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

The Compose stack starts PostgreSQL, Django, and Vite with source directories
mounted for development. Stop it with:

```bash
docker compose down
```

Database data is kept in the named `postgres_data` volume.

## Running Tests

Backend checks:

```bash
cd backend
ruff check .
ruff format --check .
mypy .
pytest
```

Additional backend project checks used during module verification:

```bash
python manage.py makemigrations --check --dry-run
python manage.py check
```

Frontend checks:

```bash
cd frontend
npm run lint
npm run build
npm run test
npm run e2e
```

Playwright E2E uses the built Vite preview app. The configured preview URL is
`http://localhost:4173`, started by:

```bash
npm run preview -- --port 4173 --strictPort
```

Latest verified suite results at Module 14:

- Backend PostgreSQL: 589 passing cases
- Frontend: 237 tests across 36 files
- Playwright E2E: 23/23 passing
- Latest tag: `module-14-pharmacist-review-workflow-complete`

## Documentation

- [Demo Evidence Pack](docs/demo-evidence.md)
- [TRUD dm+d Reference Data Import](docs/trud-dmd-import.md)

## Demo Users

Seed demo data with:

```bash
cd backend
python manage.py seed_demo
```

Shared demo-only password: `DemoPass!2026`

| Email | Role | Scope | Password |
| --- | --- | --- | --- |
| `admin@demo.local` | ADMIN | Global/admin | `DemoPass!2026` |
| `superintendent@demo.local` | SUPERINTENDENT | JMW Pharmacy Group | `DemoPass!2026` |
| `pharmacist@demo.local` | PHARMACIST | JMW Sutton (`SUT`) | `DemoPass!2026` |
| `dispenser@demo.local` | DISPENSER | JMW Croydon (`CRO`) | `DemoPass!2026` |
| `stock@demo.local` | STOCK_EMPLOYEE | JMW Sutton and JMW Croydon stock scope | `DemoPass!2026` |

## Safety and Privacy Limitations

- Patient PII is encrypted using `EncryptedTextField`.
- Pseudonymous `patient_reference` values are used in UI and audit contexts
  where possible.
- Audit metadata is designed to remain PII-free.
- Audit events are append-only at application level.
- Stock movements are append-only at application level.
- Demo data is fictional and must not be replaced with real patient data.
- There is no NHS integration.
- The system does not perform clinical diagnosis, automated clinical
  recommendations, or drug-interaction checking.
- Pharmacist reviews are operational workflow records, not clinical decision
  automation.
- External messaging, email, SMS, push notifications, and persisted
  notification read-state are not implemented.
- This is not a production-ready system and does not claim regulatory,
  clinical, GDPR, or compliance certification.

## Known Limitations and Future Work

- Real ML demand forecasting and model evaluation remain future work.
- Persisted notifications, unread state, mark-read, and scheduled alert jobs are
  not implemented.
- Email, SMS, and push notification delivery are not implemented.
- PDF report generation is not implemented.
- Medication-line-to-review shortcuts could be added in a later slice.
- Deeper production hardening, database-level immutability, monitoring, backup
  strategy, and deployment security are outside the prototype scope.
