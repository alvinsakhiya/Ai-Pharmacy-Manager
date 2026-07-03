# Project Map

A guided tour of the AI Pharmacy Manager source code: what each part is, who
uses it, and how the pieces fit together. For a file-by-file table see
[FILE_MANIFEST.md](FILE_MANIFEST.md); for the visual versions see
[DIAGRAMS.md](DIAGRAMS.md).

## Big picture

The project is a two-tier web application:

- **Backend** — Django 5.2 + Django REST Framework, a JSON API over PostgreSQL.
- **Frontend** — React 19 + Vite + TypeScript + Tailwind, a role-based single-page
  app that consumes the API.
- **Orchestration** — Docker Compose runs PostgreSQL 17, the backend, and the
  frontend together for local development and demos.

```
Project/
├── backend/      Django REST API (business logic, database, auth, backups)
├── frontend/     React SPA (the user interface)
├── docs/         Project documentation (this folder)
├── .github/      Continuous integration (CI) workflows
├── docker-compose.yml   Local/dev stack: db + backend + frontend
├── .env.example  Template for the environment variables you need
└── README.md     Top-level overview
```

## Backend (`backend/`)

Django project split into small, focused **apps** under `backend/apps/`. Every
app is registered in `backend/config/settings/base.py` and mounted in
`backend/config/urls.py`.

| App | What it does | API prefix |
| --- | --- | --- |
| `core` | Shared base models/mixins (timestamps, soft-delete, tenant-scoped querysets) and the demo-data seeding commands. No URLs of its own. | — |
| `accounts` | Custom email-based user model, authentication (login/logout, change password) and user administration. | `/api/auth/`, `/api/users/` |
| `tenancy` | The multi-tenant structure — groups and pharmacies, memberships, roles, and the row-level scoping policy enforced everywhere else. | `/api/tenancy/` |
| `audit` | Append-only audit log of who did what, with automatic auth-event capture. | `/api/audit/` |
| `catalogue` | Medication/product reference catalogue, including dm+d reference-data import. | `/api/catalogue/` |
| `inventory` | Stock items, batches, movements; receiving, adjusting, and transferring stock (FEFO expiry tracking). | `/api/inventory/` |
| `patients` | Patient records with application-level field encryption, GP details, and notes. | `/api/patients/` |
| `blister` | Dosette / MDS medication lines, cycles, dosette periods, picking lists, and stock deduction. | `/api/patients/<id>/medications`, `/cycles`, `/dosette-periods` |
| `analytics` | Explainable stock intelligence: moving-average forecasts, stock overview, and transfer suggestions. | `/api/analytics/` |
| `reports` | CSV/report generation over stock and dosette data. | `/api/reports/` |
| `notifications` | Alerts, the notification centre, and the "what needs attention" work queue. | `/api/notifications/` |
| `reviews` | The operational pharmacist review workflow (non-clinical). | `/api/reviews/` |
| `backups` | Encrypted group backups and restore, schedules, and the backup-key command. | `/api/backups/` |

Supporting backend files:

- `backend/config/` — project settings (`settings/base.py`, `dev.py`, `prod.py`),
  root URL routing (`urls.py`), and WSGI/ASGI entrypoints.
- `backend/manage.py` — Django management entrypoint (`migrate`, `runserver`,
  custom commands such as `seed_demo`, `generate_backup_key`).
- `backend/pyproject.toml` — Python dependencies and tool config (ruff, mypy).
- `backend/pytest.ini` — test configuration (uses the dev settings module).
- `backend/Dockerfile` — backend container image.

Business logic lives in each app's `services.py` (pure functions/operations),
`views.py` (HTTP endpoints), `serializers.py` (input/output shapes), and
`models.py` (database tables). Tests live in each app's `tests/`.

## Frontend (`frontend/`)

A Vite single-page app under `frontend/src/`.

- `src/app/` — the shell and routing: `AppRouter`, `AppShell`, `ProtectedRoute`,
  `RequirePermission`, and the navigation config. This is where auth and
  permission gating are enforced in the UI.
- `src/auth/` — authentication context, the permissions hook, and the auth API
  client.
- `src/features/` — one folder per screen/area, each mapping closely onto a
  backend app: `auth`, `dashboard`, `catalogue`, `inventory`, `patients`,
  `dosette`, `analytics` (stock intelligence), `reports`, `notifications`,
  `reviews`, `audit`, `tenancy`, `users`, `settings`, plus a small
  `placeholders` stub.
- `src/components/` — shared UI primitives (`ui/`), navigation (`nav/`), and brand
  (`brand/`).
- `src/lib/` — cross-cutting utilities: the API client, the query client, tenant
  scope helpers, and smart search.
- `src/styles/` — the global stylesheet and Tailwind layers.
- `frontend/e2e/` — Playwright end-to-end specs organised by role and flow.

Each feature folder typically contains its screen(s), an `api.ts` client, a
`use*.ts` data hook (React Query), and co-located tests.

## How a request flows

1. A user acts in a React screen under `src/features/…`.
2. The feature's API client (`src/lib` + feature `*Api.ts`) calls the backend
   over the Vite `/api` proxy, sending the session cookie and CSRF token.
3. Django routes the request (`config/urls.py` → app `urls.py` → `views.py`).
4. The view checks permissions (`tenancy` `require(...)`), calls `services.py`,
   which reads/writes `models.py` in PostgreSQL, and records an audit event where
   relevant.
5. The serializer shapes the response back to the frontend.

See [API_ENDPOINTS.md](API_ENDPOINTS.md) for the full endpoint list,
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for the tables, and
[SECURITY_AND_DATA_PROTECTION.md](SECURITY_AND_DATA_PROTECTION.md) for how access
is controlled.

## Documentation index

- [FILE_MANIFEST.md](FILE_MANIFEST.md) — file-by-file table
- [API_ENDPOINTS.md](API_ENDPOINTS.md) — every REST endpoint
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — models and relationships
- [INSTALLATION.md](INSTALLATION.md) — install dependencies and run the project
- [DEPLOYMENT.md](DEPLOYMENT.md) — running and deploying the stack
- [ORACLE_FREE_VM_DEPLOYMENT.md](ORACLE_FREE_VM_DEPLOYMENT.md) — secure free-VM
  deployment guide (synthetic demo)
- [FORECASTING_AND_INTELLIGENCE.md](FORECASTING_AND_INTELLIGENCE.md) — how the
  "intelligence" actually works
- [SECURITY_AND_DATA_PROTECTION.md](SECURITY_AND_DATA_PROTECTION.md) — auth, RBAC,
  encryption, audit
- [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md) — backup format and restore
- [DEMO_DATABASE_RESTORE.md](DEMO_DATABASE_RESTORE.md) — restore the demo
  PostgreSQL database on another system
- [DIAGRAMS.md](DIAGRAMS.md) — architecture and workflow diagrams
