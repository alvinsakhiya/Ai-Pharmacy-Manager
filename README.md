# AI Pharmacy Manager

A secure web application for pharmacy stock control, expiry review, patient
dosette/MDS workflow support, operational reports, and explainable stock
intelligence — brought together in one role-based system for a pharmacy group
and its branches.

> **Fictional data only.** This is an academic prototype that uses fictional
> demo data. It does **not** integrate with NHS systems, does **not** use real
> patient data, and does **not** perform clinical decision-making, diagnosis,
> automated recommendations, or compliance certification.

## What problem it solves

Community pharmacies juggle stock, expiry dates, monthly dosette (MDS) packs, and
records across systems and spreadsheets. AI Pharmacy Manager brings the day-to-day
operational picture into one place to help reduce:

- **Stock waste** from over-ordering and dead/slow-moving stock.
- **Expiry risk**, by surfacing batches nearing their expiry date (FEFO).
- **Fragmented records** across stock, patients, and dosette packs.
- **Manual MDS workload**, by showing what upcoming cycles will need.
- **Lack of review visibility**, with a clear "what needs attention" queue.

Everything the system suggests is **advisory and requires human review** — nothing
is ordered, transferred, or dispensed automatically.

## Main features

- **Role-based login** with per-role screens and permissions.
- **Dashboard** — a daily summary of what needs attention.
- **Inventory** — stock items, batches, receiving, adjustments, transfers, and an
  append-only movement history (FEFO expiry tracking).
- **Patient records** — with application-level field encryption and searchable,
  privacy-preserving lookups.
- **Dosette / MDS** — medication lines, cycles, a preparation workflow, and a
  printable picking/tray sheet.
- **Stock Intelligence** — explainable forecasts, expiry risk, MDS demand, and
  transfer suggestions to review.
- **Reports** — stock, expiry, MDS workload, and movement reports with CSV export.
- **Alerts** and a **work queue** highlighting operational items.
- **Pharmacist review workflow** — an operational (non-clinical) review queue.
- **Audit log** — an append-only record of who did what.
- **Backups** — encrypted, group-scoped backups with a guarded restore.
- **Settings** — including backup configuration.

## User roles

| Role | Scope | What they can do (in brief) |
| --- | --- | --- |
| **Admin** | Global | Full access across every group and pharmacy. |
| **Superintendent** | One pharmacy group | Stock, forecasts, transfer suggestions, medications, audit view across the group's branches. |
| **Pharmacist** | One pharmacy | Full stock, patients, dosette, reviews, and user management for their pharmacy. |
| **Dispenser** | One pharmacy | View patients/stock, receive stock, dosette status changes, review view. |
| **Stock employee** | A group + a chosen set of pharmacies | Stock management, receiving, transfers, and forecasts. |

See [docs/SECURITY_AND_DATA_PROTECTION.md](docs/SECURITY_AND_DATA_PROTECTION.md)
for how access is enforced.

## Explainable intelligence (the "AI")

The "intelligence" is **explainable, deterministic arithmetic** — not a black-box
model. Given the same data and date, it always produces the same result, and every
output is a signal to review, never an action. It includes:

- **Moving-average forecasting** — estimated demand from recent stock movements.
- **FEFO expiry logic** — surfacing and bucketing batches by soonest expiry.
- **Deterministic MDS demand signal** — what upcoming dosette cycles will need
  versus available stock.
- **Stock review scoring** — a transparent, additive 0–100 priority score.
- **Transfer opportunity review** — where dead stock at one branch could cover
  demand at another (a suggestion only; no stock is moved).
- **Forecast confidence labels** — a simple indication of how much history a
  forecast is based on (not a guarantee of accuracy).
- **Human review required** — nothing is ordered, transferred, or dispensed
  automatically.

No clinical AI, diagnosis, NHS/NCRS integration, guaranteed forecast, or automatic
actions are claimed. Full detail and honest limitations are in
[docs/FORECASTING_AND_INTELLIGENCE.md](docs/FORECASTING_AND_INTELLIGENCE.md).

## Technology stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, TanStack Query.
- **Backend:** Django and Django REST Framework.
- **Database:** PostgreSQL (the runtime and deployment database).
- **Local orchestration:** Docker Compose.
- **Quality & tests:** pytest (backend), Vitest and Playwright (frontend),
  Ruff (lint/format), mypy (types), ESLint, and pre-commit.

## Installation and dependencies

The source zip contains the code and dependency manifests, but not installed
dependencies — `node_modules/` and the Python virtual environment (`.venv/`) are
intentionally excluded and are recreated from `frontend/package.json` +
`frontend/package-lock.json` and `backend/pyproject.toml`. The easiest way to set
everything up is Docker Compose (see below), which installs all dependencies
inside the containers.

Full step-by-step installation (with and without Docker), environment variables,
and troubleshooting are in [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Local setup

The simplest way to run the whole stack is with Docker Compose.

```bash
# 1. Create your environment file from the template
cp .env.example .env

# 2. Build and start PostgreSQL, the backend, and the frontend
docker compose up --build

# 3. In another terminal: apply migrations and seed fictional demo data
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo
```

Then open the app:

- **Frontend:** <http://localhost:5173>
- **Backend API:** <http://localhost:8000> (health check at `/api/health/`)
- **PostgreSQL:** runs as the `db` service inside Docker (not published to your
  host by default).

`seed_demo` is safe to re-run and only touches the fictional `@demo.local`
workspace. Full instructions, environment variables, and a production checklist
are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Demo database restore

The source-code zip (built with `git archive`) contains the code only — it does
**not** include the database. To reproduce the exact demo data on another
machine, use the separate PostgreSQL dump
(`ai-pharmacy-manager-demo-database.sql`, fictional data only) and load it into
the running `db` service with Docker Compose:

```bash
cat ../ai-pharmacy-manager-demo-database.sql | docker compose exec -T db psql -U pharmacy -d pharmacy
```

Step-by-step instructions, verification, and troubleshooting are in
[docs/DEMO_DATABASE_RESTORE.md](docs/DEMO_DATABASE_RESTORE.md).

## Demo accounts

The seeded demo users share a single **demo-only** password.

> **Demo-only credentials.** These accounts and the shared password exist only
> for local demonstration with fictional data. Before any public or internet
> deployment, **rotate the password and disable or remove the demo accounts** —
> `admin@demo.local` has global administrator access.

Shared password: `DemoPass!2026`

| Email | Role | Scope |
| --- | --- | --- |
| `admin@demo.local` | Admin | Global |
| `superintendent@demo.local` | Superintendent | JMW Pharmacy Group |
| `pharmacist@demo.local` | Pharmacist | JMW Sutton |
| `dispenser@demo.local` | Dispenser | JMW Croydon |
| `stock@demo.local` | Stock employee | JMW Sutton and JMW Croydon |

## Backup and restore

Group backups capture the operational records for one pharmacy group (stock,
patients, dosette, reviews, analytics, and audit) — never user accounts or
password hashes.

- **Encrypted backups:** archives are encrypted at rest with **AES-256-GCM**.
  Provide a base64 32-byte key via the `BACKUP_ENCRYPTION_KEY` environment
  variable; generate one with
  `docker compose exec backend python manage.py generate_backup_key`. In
  production, encrypted backups are required by default.
- **Restore is guarded:** restore is admin-only, requires typing `RESTORE` to
  confirm, validates the archive (a wrong or missing key is rejected before
  anything changes), and takes a **pre-restore safety backup** first.
- **Production storage:** keep archives in private, access-controlled storage
  (not a public web directory), store the key separately in a secrets manager,
  and add regular database-level backups (`pg_dump`/managed snapshots) off-site.

Full details: [docs/BACKUP_AND_RESTORE.md](docs/BACKUP_AND_RESTORE.md).

## Deployment

- The included Docker Compose file is **development-oriented** (Django's dev
  server and the Vite dev server).
- For production, use the production settings
  (`DJANGO_SETTINGS_MODULE=config.settings.prod`), which enforce `DEBUG=False`,
  HSTS, HTTPS redirect, secure cookies, required secret/encryption keys, and
  encrypted backups; serve the backend behind a production WSGI/ASGI server and a
  TLS-terminating reverse proxy, and build the frontend to static assets.
- Set real values for `DJANGO_SECRET_KEY`, `PATIENT_FIELD_KEY`,
  `PATIENT_INDEX_KEY`, `BACKUP_ENCRYPTION_KEY`, `DJANGO_ALLOWED_HOSTS`,
  `CSRF_TRUSTED_ORIGINS`, and `CORS_ALLOWED_ORIGINS`.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full checklist.

## Testing

Frontend (via Docker Compose, or `cd frontend` and drop the prefix):

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
docker compose exec frontend npm run test
```

Backend migration check (via Docker Compose):

```bash
docker compose exec backend python manage.py makemigrations --check --dry-run
```

Backend tests, linting, and type checks run against PostgreSQL. From `backend/`
in a virtual environment with the dev extras installed
(`pip install -e ".[dev]"`):

```bash
ruff check .
ruff format --check .
mypy .
pytest
```

Continuous integration (`.github/workflows/`) runs the backend checks against a
PostgreSQL service and the frontend lint/build/test, plus Playwright end-to-end
tests.

## Project structure

```
backend/    Django REST API — apps/ (business logic), config/ (settings, urls)
frontend/   React SPA — src/features/ (screens), src/components/, src/lib/
docs/       Project documentation (see below)
.github/    Continuous integration workflows
docker-compose.yml   Local dev stack: PostgreSQL + backend + frontend
.env.example         Environment variable template
```

Documentation:

- [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) — guided tour of the source code
- [docs/FILE_MANIFEST.md](docs/FILE_MANIFEST.md) — file-by-file map
- [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md) — all REST endpoints
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) — models and relationships
- [docs/INSTALLATION.md](docs/INSTALLATION.md) — install dependencies and run the
  project
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — running and deploying the stack
- [docs/ORACLE_FREE_VM_DEPLOYMENT.md](docs/ORACLE_FREE_VM_DEPLOYMENT.md) —
  secure free-VM deployment for a synthetic-data public demo
- [docs/OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md) — day-to-day
  operations for the deployed demo
- [docs/INDUSTRY_HARDENING_REPORT.md](docs/INDUSTRY_HARDENING_REPORT.md) —
  final hardening evidence and limitations
- [docs/FORECASTING_AND_INTELLIGENCE.md](docs/FORECASTING_AND_INTELLIGENCE.md) —
  how the intelligence works, honestly
- [docs/SECURITY_AND_DATA_PROTECTION.md](docs/SECURITY_AND_DATA_PROTECTION.md) —
  authentication, roles, encryption, audit
- [docs/BACKUP_AND_RESTORE.md](docs/BACKUP_AND_RESTORE.md) — backup format and
  restore
- [docs/DEMO_DATABASE_RESTORE.md](docs/DEMO_DATABASE_RESTORE.md) — restore the
  demo PostgreSQL database on another system
- [docs/DIAGRAMS.md](docs/DIAGRAMS.md) — architecture and workflow diagrams
- [docs/GITHUB_REPO_SETUP.md](docs/GITHUB_REPO_SETUP.md) — repository presentation

## Data protection and honest limitations

- Patient identifier fields and note bodies are stored with **application-level
  field encryption at rest** (with a blind index for search). This is encryption
  at rest, **not** end-to-end database encryption — the server holds the key and
  decrypts values to display, search, report, and back up.
- Audit events and stock movements are append-only at the application level.
- The system uses **fictional demo data**; never store real patient data.
- There is **no** NHS/NCRS integration, clinical diagnosis, drug-interaction
  checking, automatic ordering/transfer/dispensing, guaranteed forecasting, or
  compliance certification.
- Pharmacist reviews are operational workflow records, not clinical decisions.
- This is a prototype, not a production-hardened system; deeper production
  hardening (database-level immutability, monitoring, key management, and a
  production deployment profile) is future work.

## License

No public licence is specified for this repository.
