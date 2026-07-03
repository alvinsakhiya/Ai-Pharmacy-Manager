# Deployment

How to run AI Pharmacy Manager locally and what is required to deploy it. The
runtime and deployment database is **PostgreSQL** — see
[Database](#database-postgresql) below.

## Services (Docker Compose)

`docker-compose.yml` defines three services for local development and demos:

| Service | Image / build | Port | Notes |
| --- | --- | --- | --- |
| `db` | `postgres:17-alpine` | internal only (`db:5432`) | Named volume `postgres_data`; `pg_isready` healthcheck. |
| `backend` | built from `./backend` (`python:3.13-slim`) | `8000:8000` | Runs `manage.py runserver`; reads `.env`; waits for `db` to be healthy. |
| `frontend` | built from `./frontend` (`node:22-alpine`) | `5173:5173` | Runs the Vite dev server; proxies `/api` to the backend. |

- Frontend dev server: <http://localhost:5173>
- Backend API: <http://localhost:8000> (health check at `/api/health/`)
- PostgreSQL: reachable inside the Compose network as `db:5432` (not published to
  the host by default).

> **This Compose file is development-oriented.** The backend runs Django's
> `runserver` and the frontend runs the Vite dev server. The production demo
> path is `docker-compose.prod.yml`: gunicorn behind a TLS-terminating Caddy
> reverse proxy, with the frontend built (`npm ci && npm run build`) into the
> Caddy image. See [Production checklist](#production-checklist) and
> [ORACLE_FREE_VM_DEPLOYMENT.md](ORACLE_FREE_VM_DEPLOYMENT.md).

## Local setup

```bash
# 1. Create your environment file from the template
cp .env.example .env
# (edit .env as needed; the defaults work for local Docker)

# 2. Build and start the stack
docker compose up --build

# 3. Apply migrations (first run) and seed fictional demo data
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo
```

Then open <http://localhost:5173> and sign in with a demo account (see the
README for demo credentials). `seed_demo` is idempotent and only touches the
fictional `@demo.local` workspace.

## Environment variables

`backend/config/settings/base.py` loads `.env` and reads the following. Values
marked *dev default* are safe only for local development; production **must**
override the secrets.

| Variable | Purpose | Dev default |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | Django cryptographic secret | `unsafe-development-key` (prod refuses to start if unset/left at default) |
| `DJANGO_DEBUG` | Debug mode | `False` (dev settings force `True`) |
| `DJANGO_ALLOWED_HOSTS` | Allowed Host headers | `localhost,127.0.0.1` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://pharmacy:pharmacy@localhost:5432/pharmacy` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Postgres container init + `DATABASE_URL` build | `pharmacy` (each) |
| `PATIENT_FIELD_KEY` | Fernet key for patient field encryption | dev-only key (prod refuses to start if unset/left at default) |
| `PATIENT_INDEX_KEY` | HMAC key for the last-name blind index | dev-only key (prod refuses to start if unset/left at default) |
| `BACKUP_ENCRYPTION_KEY` | base64 32-byte AES-256-GCM key for backups | empty (unencrypted dev backups allowed) |
| `BACKUP_ENCRYPTION_REQUIRED` | Refuse backups without a key | `False` in base, `True` in production |
| `BACKUP_ROOT` | Backup storage directory | `backend/media/backups/` |
| `APP_VERSION` | Version recorded in backup manifests | `1.0.0` |
| `LOGIN_THROTTLE_RATE` | Login rate limit | `10/min` |
| `CSRF_TRUSTED_ORIGINS` | CSRF trusted origins (comma list) | empty (`.env.example` sets `http://localhost:5173`) |
| `CORS_ALLOWED_ORIGINS` | CORS allowed origins (comma list) | empty (`.env.example` sets `http://localhost:5173`) |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | Secure-cookie flags | `False` in dev (production forces both `True`) |
| `API_PROXY_TARGET` | Frontend Vite `/api` proxy target | `http://backend:8000` |
| `DJANGO_SETTINGS_MODULE` | Which settings module to load | `config.settings.dev` |

`.env.example` also lists `TRUD_API_KEY` / `TRUD_DMD_ITEM_ID` /
`TRUD_DMD_RELEASE_FILE` (used only by the optional dm+d reference-data import)
and `VITE_API_BASE_URL` (frontend build-time; leave blank so the SPA calls the
API through relative `/api` paths behind one reverse proxy — session and CSRF
cookies are origin-scoped, so a cross-origin value silently breaks all
authenticated requests; see `.env.example` and
`docs/ORACLE_FREE_VM_DEPLOYMENT.md`).

## Database (PostgreSQL)

- The application database is **PostgreSQL** in every environment. `DATABASE_URL`
  is parsed by `dj-database-url`; the driver dependency is `psycopg` (PostgreSQL).
  There is no SQLite driver dependency and no SQLite database configuration.
- **Tests also run against PostgreSQL by default.** `pytest.ini` sets
  `DJANGO_SETTINGS_MODULE=config.settings.dev`, which inherits the PostgreSQL
  `DATABASE_URL` config. CI runs the suite against a Postgres service.
- **SQLite** appears only as *optional, throwaway test infrastructure*: a
  developer running the backend test suite on a host without a Postgres instance
  can point `DATABASE_URL` at a temporary SQLite file for that run, e.g.
  `DATABASE_URL=sqlite:////tmp/test.sqlite3 pytest`. This is a per-run override for
  isolated local testing only — SQLite is never the application/runtime database.

## Static and media handling

- **Frontend:** the development Compose setup serves the Vite dev server. In
  production (`docker-compose.prod.yml`) the SPA is built inside the image
  (`npm ci && npm run build`) and baked into the Caddy image, which serves it
  and reverse-proxies `/api` to the backend on the same origin.
- **Backend static:** `STATIC_ROOT` is `backend/staticfiles/`; run
  `manage.py collectstatic` when serving Django-rendered static in production.
- **Media / backups:** `MEDIA_ROOT` is `backend/media/` and backups default to
  `backend/media/backups/` (git-ignored, not publicly served). See
  [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md).

## Production checklist

Before deploying to the internet:

- [ ] Set a strong unique `DJANGO_SECRET_KEY`.
- [ ] Set `PATIENT_FIELD_KEY` and `PATIENT_INDEX_KEY` (prod refuses to start
      otherwise). Store them in a secrets manager.
- [ ] Set `BACKUP_ENCRYPTION_KEY` (production requires encrypted backups by
      default) and store/rotate it separately from the archives.
- [ ] Use `config.settings.prod` (`DJANGO_SETTINGS_MODULE=config.settings.prod`).
      This enforces `DEBUG=False`, HSTS, `SECURE_SSL_REDIRECT`, and secure cookies.
- [ ] Serve over TLS/HTTPS behind a reverse proxy; the app trusts
      `X-Forwarded-Proto` for TLS termination.
- [ ] Set `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and
      `CORS_ALLOWED_ORIGINS` to your real origins.
- [ ] Run the backend under a production WSGI/ASGI server (not `runserver`) —
      `docker-compose.prod.yml` runs gunicorn (a declared backend dependency).
- [ ] Build and serve the frontend as static assets (not the Vite dev server) —
      the production Compose file builds the SPA into the Caddy image.
- [ ] Run `manage.py migrate` on deploy (the production Compose command applies
      migrations before starting gunicorn). `collectstatic` is only needed if
      Django-rendered static pages are ever served (the API does not need it).
- [ ] Configure database backups (`pg_dump`/managed snapshots) in addition to the
      in-app group backups, and store backups off-site.
- [ ] **Rotate or disable the demo accounts** before exposing the app: change
      the shared `DemoPass!2026` password and disable/remove the `@demo.local`
      users (especially the global-admin `admin@demo.local`). Do not run
      `seed_demo` against a public database with the shipped password.
- [ ] Set `SESSION_COOKIE_AGE` (default 12h) and `LOG_LEVEL` as required.
- [ ] Never commit real secrets; `.env` is git-ignored. Serve backend entrypoints
      (gunicorn/uvicorn) with `config.settings.prod` — the WSGI/ASGI modules now
      default to prod and will fail fast if the required secrets are unset.

See [SECURITY_AND_DATA_PROTECTION.md](SECURITY_AND_DATA_PROTECTION.md) for the
full security posture,
[ORACLE_FREE_VM_DEPLOYMENT.md](ORACLE_FREE_VM_DEPLOYMENT.md) for a step-by-step
secure free-VM deployment (Docker Compose, internal-only PostgreSQL, optional
DuckDNS + Caddy HTTPS) for a synthetic-data public demo, and
[OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) for day-to-day operations after
deployment.
