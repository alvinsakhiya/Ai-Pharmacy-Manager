# File Manifest

A map of the meaningful tracked files and folders in the repository, with what each is for and whether it is needed at runtime, for tests, or for deployment. Generated/vendored paths are deliberately excluded: `node_modules/`, `.git/`, `.venv/`, `__pycache__/`, caches, build output, and `media/backups/`. Local-only untracked files (personal notes and scratch material) are also excluded.

**Runtime** = needed for the running app · **Test** = needed for the test suite / CI · **Deploy** = needed to build or deploy · **Safe to delete**: *Keep* (load-bearing) / *Review* (unused or stub, confirm before removing).

| Path | Type | Purpose | Used by | Runtime | Test | Deploy | Safe to delete | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `backend/` | folder | Django REST backend root: manage.py, config/, apps/, pyproject, pytest.ini, Dockerfile. Hosts the API and business logic. | Whole system; served via docker-compose backend service and CI backend job | Yes | Yes | Yes | Keep | Core of the application. |
| `frontend/` | folder | React 19 + Vite + Tailwind SPA root: src/, e2e/, config files, Dockerfile. Role-based pharmacy UI consuming the backend API. | End users via browser; docker-compose frontend service; CI frontend + E2E jobs | Yes | Yes | Yes | Keep | — |
| `docs/` | docs | Project documentation: project map, file manifest, installation, API endpoints, database schema, deployment, security & data protection, backup/restore, demo database restore, forecasting/intelligence, diagrams, GitHub setup, plus dm+d import and demo evidence/script guides. | Developers, graders/examiners, operators | — | — | — | Keep | Listed at folder granularity; individual docs are not enumerated as separate rows. Load-bearing for the project deliverable; not shipped at runtime. |
| `.github/` | folder | GitHub Actions CI/CD: workflows/ci.yml (backend lint/type/test + frontend lint/build/test) and workflows/e2e.yml (Playwright). | GitHub Actions on push/PR | — | Yes | Yes | Keep | — |
| `backend/apps/core/` | backend-app | Foundational base models/mixins (TimeStampedModel, SoftDeleteModel, tenant-scoped querysets) plus seed_demo/reset_demo_data management commands. | Every other backend app inherits from it; demo seeding CLI | Yes | Yes | Yes | Keep | No URLs; pure shared foundation. Deleting breaks all apps. |
| `backend/apps/accounts/` | backend-app | Custom user model, authentication (login/logout, change password) and user administration. Exposes /api/auth/ and /api/users/. | Frontend auth + users features; all authenticated endpoints | Yes | Yes | Yes | Keep | — |
| `backend/apps/tenancy/` | backend-app | Multi-tenant org structure (Group, Pharmacy), memberships, permissions and row-level scoping policy/signals. Exposes /api/tenancy/. | Frontend tenancy feature; scoping enforced across all apps | Yes | Yes | Yes | Keep | — |
| `backend/apps/audit/` | backend-app | Append-only audit event log with signals, services, admin and paginated API. Exposes /api/audit/. | Frontend audit feature; other apps emit audit events | Yes | Yes | Yes | Keep | — |
| `backend/apps/catalogue/` | backend-app | Medication/product catalogue with dm+d and TRUD import (import_dmd, import_trud_dmd, seed_catalogue commands). Exposes /api/catalogue/. | Frontend catalogue feature; inventory and dosette reference data | Yes | Yes | Yes | Keep | — |
| `backend/apps/inventory/` | backend-app | Stock items, batches, movements, receiving, adjustments and transfers (FEFO stock). Exposes /api/inventory/. | Frontend inventory feature; analytics and reports consume stock data | Yes | Yes | Yes | Keep | — |
| `backend/apps/patients/` | backend-app | Patient records with application-level field encryption (crypto/fields), GP details and notes. Exposes /api/patients/. | Frontend patients feature; blister/dosette workflows | Yes | Yes | Yes | Keep | Fictional demo data only; prototype encryption at rest. |
| `backend/apps/blister/` | backend-app | Dosette/MDS medication records, cycles, dosette periods, picking lists and stock deduction. Mounted under /api/patients/<pk>/medications\|cycles\|dosette-periods/. | Frontend dosette feature; inventory (stock deduction) | Yes | Yes | Yes | Keep | — |
| `backend/apps/analytics/` | backend-app | Forecast runs, stock overview and inter-pharmacy transfer suggestions. Exposes /api/analytics/. | Frontend analytics feature (stock intelligence screens) | Yes | Yes | Yes | Keep | — |
| `backend/apps/reports/` | backend-app | CSV/report generation services over stock and dosette data. Exposes /api/reports/. | Frontend reports feature | Yes | Yes | Yes | Keep | — |
| `backend/apps/notifications/` | backend-app | Alerts, notification centre and work-queue generation with dismissals. Exposes /api/notifications/. | Frontend notifications feature (alerts, work queue, notification centre) | Yes | Yes | Yes | Keep | — |
| `backend/apps/reviews/` | backend-app | Operational pharmacist review workflow (review records, status/priority). Exposes /api/reviews/. | Frontend reviews feature | Yes | Yes | Yes | Keep | — |
| `backend/apps/backups/` | backend-app | Encrypted backup schedules/runs (AES-256-GCM), generate_backup_key and run_scheduled_backups commands. Exposes /api/backups/. | Operators/admins; scheduled backup task; frontend settings | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/auth/` | frontend-feature | Login and change-password screens. | All users at sign-in; wired via AppRouter | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/dashboard/` | frontend-feature | Landing dashboard screen after login. | All authenticated users | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/catalogue/` | frontend-feature | Medication catalogue browsing, product select and medication form modal. | Users managing medications; consumes /api/catalogue/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/inventory/` | frontend-feature | Stock inventory screens: add/receive/adjust/count/transfer batches and stock item detail. | Stock employees/pharmacists; consumes /api/inventory/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/patients/` | frontend-feature | Patient list/detail screens, patient/GP form modals, notes and medication history. | Pharmacists/dispensers; consumes /api/patients/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/dosette/` | frontend-feature | Dosette/MDS screens: dosette cycle and patient medication form modals. | Dispensers building dosette packs; consumes blister API | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/analytics/` | frontend-feature | Stock analytics / intelligence screen (forecasts, overview, transfer suggestions). | Superintendents/managers; consumes /api/analytics/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/reports/` | frontend-feature | Reports screen (CSV/report downloads). | Managers; consumes /api/reports/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/notifications/` | frontend-feature | Alerts screen, notification centre and work-queue screen. | All users; consumes /api/notifications/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/reviews/` | frontend-feature | Pharmacist reviews screen, review cards/badges and form modal; patient reviews section. | Pharmacists; consumes /api/reviews/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/audit/` | frontend-feature | Audit log screen with action filtering. | Admins/superintendents; consumes /api/audit/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/tenancy/` | frontend-feature | Organisation screen: groups and pharmacies management with form modals. | Admins/superintendents; consumes /api/tenancy/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/users/` | frontend-feature | User administration: users table, create user, reset password, reassign membership. | Admins; consumes /api/users/ | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/settings/` | frontend-feature | Settings screen (incl. backups/preferences). | Admins/operators; consumes /api/backups/ and preferences | Yes | Yes | Yes | Keep | — |
| `frontend/src/features/placeholders/` | frontend-feature | ModulePlaceholder component for not-yet-implemented modules/routes. | AppRouter for placeholder routes | Yes | — | Yes | Review | Small stub; keep while any nav entry points at it, otherwise removable. |
| `backend/config/settings/base.py` | config | Shared Django settings: INSTALLED_APPS (13 local apps), DB via DATABASE_URL, DRF, CORS/CSRF, encryption keys, env helpers. | All Django processes (imported by dev/prod) | Yes | Yes | Yes | Keep | — |
| `backend/config/settings/dev.py` | config | Development settings (DEBUG=True) importing base; default DJANGO_SETTINGS_MODULE for tests. | Local dev server, pytest, CI test job | Yes | Yes | — | Keep | — |
| `backend/config/settings/prod.py` | config | Production settings (DEBUG=False) enforcing required secret/encryption keys and mandatory encrypted backups. | Production deployment | Yes | — | Yes | Keep | — |
| `backend/pyproject.toml` | config | Python packaging + deps (Django 5.2, DRF, psycopg, cryptography) and tool config for black/ruff/mypy; dev extras (pytest, pre-commit). | pip install, CI, Docker build, linters/type-checker | Yes | Yes | Yes | Keep | — |
| `backend/pytest.ini` | config | Pytest config: DJANGO_SETTINGS_MODULE=config.settings.dev, test discovery, strict markers. | pytest locally and in CI | — | Yes | — | Keep | — |
| `frontend/package.json` | config | Frontend deps (React 19, react-router, react-query, framer-motion, Vite, Tailwind, Playwright, Vitest) and scripts (dev/build/test/e2e/lint). | npm, CI, Docker build | Yes | Yes | Yes | Keep | — |
| `frontend/vite.config.ts` | config | Vite + Vitest config: React plugin, dev server port 5173, /api proxy to backend, jsdom test env. | Dev server, build, unit tests | Yes | Yes | Yes | Keep | — |
| `frontend/tailwind.config.js` | config | Tailwind theme config (content globs, Plus Jakarta Sans font stack, theme extensions). | PostCSS/Tailwind build | Yes | — | Yes | Keep | — |
| `frontend/postcss.config.js` | config | PostCSS pipeline (tailwindcss + autoprefixer). | Vite CSS build | Yes | — | Yes | Keep | — |
| `frontend/tsconfig.json` | config | Root TS project references pointing at tsconfig.app.json and tsconfig.node.json. | tsc build, editors, CI build | — | — | Yes | Keep | Build-time only; needed by `tsc -b` in the build script. |
| `frontend/tsconfig.app.json` | config | TypeScript compiler options for the application source (src/). | tsc build, editors | — | — | Yes | Keep | — |
| `frontend/tsconfig.node.json` | config | TypeScript compiler options for Node-side config files (vite.config, etc.). | tsc build tooling | — | — | Yes | Keep | — |
| `frontend/eslint.config.js` | config | ESLint flat config (typescript-eslint, react-hooks, react-refresh). | npm run lint, CI frontend job | — | Yes | — | Keep | — |
| `frontend/playwright.config.ts` | config | Playwright E2E config: testDir ./e2e, chromium project, baseURL, reporters. | npm run e2e, E2E CI workflow | — | Yes | — | Keep | — |
| `docker-compose.yml` | docker | Local/dev orchestration: postgres 17, backend (Django runserver), frontend (Vite) with volumes, ports and healthchecks. | Developers running the stack; base for env-specific overrides | — | — | Yes | Keep | — |
| `backend/Dockerfile` | docker | Backend image: python:3.13-slim, installs project via pip, runs as non-root `appuser`; default command is gunicorn (production). | docker-compose backend build; deployment | — | — | Yes | Keep | Local development overrides the command with `runserver` in docker-compose.yml. |
| `frontend/Dockerfile` | docker | Frontend multi-stage image: `dev` (Vite dev server, default target), `build` (npm ci + npm run build), `serve` (Caddy with the built SPA baked in). | docker-compose frontend build; docker-compose.prod.yml caddy build; deployment | — | — | Yes | Keep | Production uses the `serve` stage via docker-compose.prod.yml. |
| `.env.example` | config | Template of required env vars: Django secret/hosts, Postgres/DATABASE_URL, CSRF/CORS, encryption & backup keys, Vite/API proxy, TRUD keys. | Developers to create .env; documents deployment config | — | — | Yes | Keep | Sample only; real .env is gitignored. |
| `.pre-commit-config.yaml` | config | Pre-commit hooks: ruff-check --fix, ruff-format, check-yaml, end-of-file-fixer, trailing-whitespace. | Developers via pre-commit; local quality gate | — | — | — | Keep | — |
| `.github/workflows/ci.yml` | config | CI pipeline: backend (ruff, ruff format check, mypy, pytest against Postgres) and frontend (lint, build, vitest). | GitHub Actions on push/PR | — | Yes | Yes | Keep | — |
| `.github/workflows/e2e.yml` | config | E2E pipeline: Playwright browser tests against a full stack with Postgres. | GitHub Actions on PR/manual dispatch | — | Yes | Yes | Keep | — |
| `backend/tests/` | tests | Project-level backend tests (health-check endpoint). | pytest, CI backend job | — | Yes | — | Keep | Most tests live inside each app; this holds cross-cutting/smoke tests. |
| `frontend/e2e/` | tests | Playwright end-to-end specs by role/flow (admin, dispenser, pharmacist, superintendent, inventory, dosette, alerts, reviews, stock intelligence, etc.) plus helpers. | npm run e2e, E2E CI workflow | — | Yes | — | Keep | — |
| `backend/manage.py` | root-file | Django management entrypoint (runserver, migrate, custom commands). | Developers, Docker CMD, management commands | Yes | Yes | Yes | Keep | — |
| `backend/config/urls.py` | root-file | Root URL conf mounting all 13 app API routes and health-check endpoints. | Django request routing | Yes | Yes | Yes | Keep | — |
| `backend/config/wsgi.py` | root-file | WSGI application entrypoint for production servers. | Production WSGI server (e.g. gunicorn) | Yes | — | Yes | Keep | — |
| `backend/config/asgi.py` | root-file | ASGI application entrypoint. | ASGI servers if used | Yes | — | Yes | Keep | — |
| `frontend/index.html` | root-file | Vite HTML entrypoint mounting the React app. | Vite dev/build | Yes | — | Yes | Keep | — |
| `frontend/src/main.tsx` | root-file | React app bootstrap (renders App with providers). | Browser runtime | Yes | — | Yes | Keep | — |
| `frontend/src/App.tsx` | root-file | Root App component wiring router, auth, query client and app shell. | Browser runtime; entry to all features | Yes | Yes | Yes | Keep | — |
| `frontend/src/app/` | folder | App shell and routing infrastructure: AppRouter, AppShell, ProtectedRoute, RequirePermission, PreferencesContext, navConfig. | All routed features; enforces auth and permission gating | Yes | Yes | Yes | Keep | — |
| `frontend/src/auth/` | folder | Auth context, permissions hook and auth API client. | Login flow and every permission-gated screen | Yes | Yes | Yes | Keep | — |
| `frontend/src/components/` | folder | Shared UI: ui/ primitives (Button, Modal, Table, KpiCard, etc.), nav/ (Sidebar, TopBar, CommandPalette), brand/ (AppLogo). | All feature screens | Yes | Yes | Yes | Keep | — |
| `frontend/src/lib/` | folder | Cross-cutting utilities: API client/errors, query client, tenant scope, smart search, navigation, className helper. | All features and API hooks | Yes | Yes | Yes | Keep | smartSearch suggestion labels must be derived from fields listed in `getFields` — a synthetic label empties the suggestion list on selection. |
| `frontend/src/styles/` | folder | Global stylesheet (index.css, Tailwind layers). | Whole app | Yes | — | Yes | Keep | — |
| `frontend/src/types/` | folder | Shared TypeScript types (auth). | Auth and typed API layers | — | — | Yes | Keep | Compile-time types; erased at runtime but needed for build. |
| `frontend/src/test/` | folder | Vitest test setup and shared providers wrapper. | Vitest unit/component tests | — | Yes | — | Keep | — |
| `frontend/src/hooks/` | folder | Intended shared hooks directory (currently empty). | None currently | — | — | — | Review | Empty folder; safe to remove unless reserved for upcoming shared hooks. Feature-local hooks live under each feature instead. |
| `frontend/public/` | folder | Static assets served as-is (brand/ app icon SVG). | Vite build; served at site root | Yes | — | Yes | Keep | — |
| `README.md` | docs | Top-level project overview: purpose, non-NHS/fictional-data disclaimers, implemented Phase 2 modules. | Anyone reading the repo; graders | — | — | — | Keep | — |
| `.gitignore` | root-file | Git ignore rules (env files, caches, media/backups, node_modules, build output). | Git | — | — | — | Keep | — |

## Review candidates (not deleted)

The following are flagged **Review** — unused or stub paths that are safe to remove only after confirming nothing references them. They are intentionally left in place:

- `frontend/src/features/placeholders/`
- `frontend/src/hooks/`
