# Installation and Dependencies

How to recreate all dependencies and run AI Pharmacy Manager after extracting the
source. Written to be followed step by step.

## 1. Purpose

The source zip (produced with `git archive`) contains the **source code and the
dependency manifest files** — but not the installed dependencies themselves.
Dependencies are recreated from those manifests:

- **Backend:** `backend/pyproject.toml` (Python packages, via `pip`).
- **Frontend:** `frontend/package.json` + `frontend/package-lock.json` (Node
  packages, via `npm`).
- **Everything together:** `docker-compose.yml` + `.env.example`.

## 2. What is intentionally not included

These are generated or local, and are excluded from the source zip (and from
Git). You recreate them during installation:

- `node_modules/` (recreated by `npm`)
- `.venv/` / Python virtual environment (recreated by `pip`)
- `__pycache__/` and tool caches
- Docker volumes, including the PostgreSQL data volume (`postgres_data`)
- `media/` and any backup output under `media/backups/`
- `.env` (create it from `.env.example`)
- local override files such as `docker-compose.override.yml`
- the database dump (provided separately if demo data is needed — see section 4)

## 3. Recommended installation: Docker Compose

This is the easiest way and needs only Docker Desktop (or Docker Engine) with
Docker Compose.

```bash
cd Ai-Pharmacy-Manager

# 1. Create your environment file from the template
cp .env.example .env

# 2. Build and start PostgreSQL, the backend, and the frontend
docker compose up --build
```

Then, in another terminal, apply migrations and seed fictional demo data:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo
```

Open the app:

- **Frontend:** <http://localhost:5173>
- **Backend API:** <http://localhost:8000> (health check at `/api/health/`)

`docker compose up --build` recreates all dependencies inside the containers from
the manifests (the backend image runs `pip install .`; the frontend image runs
`npm ci`), so you do not need Python or Node installed on the host for this path.

> `docker-compose.yml` is the **local development** stack (Vite dev server +
> Django `runserver`). The **production synthetic-demo** stack is
> `docker-compose.prod.yml` (gunicorn + Caddy serving the built frontend) — see
> [ORACLE_FREE_VM_DEPLOYMENT.md](ORACLE_FREE_VM_DEPLOYMENT.md).

## 4. PostgreSQL database

- **PostgreSQL is the runtime database.** It runs as the `db` service in
  `docker-compose.yml` (image `postgres:17-alpine`).
- **SQLite is not the runtime database.** (It can only appear as an optional
  temporary file for isolated local test runs.)
- After `docker compose up`, the `pharmacy` database exists but is empty until you
  either run `seed_demo` (section 3) **or** restore a supplied demo dump.
- If a demo SQL dump is provided separately
  (`ai-pharmacy-manager-demo-database.sql`), restore it by following
  [DEMO_DATABASE_RESTORE.md](DEMO_DATABASE_RESTORE.md).

## 5. Frontend dependencies without Docker

Requires **Node.js 22** (matches the project's Docker image) and npm.

```bash
cd frontend
npm ci        # reproducible install from package-lock.json
npm run dev
```

`npm ci` installs the exact versions in `package-lock.json`. If you do not need an
exact reproducible install you can use `npm install` instead. Either way,
`node_modules/` is recreated locally and **must not be committed** (it is
git-ignored).

The dev server serves the app at <http://localhost:5173> and proxies `/api` to
the backend using `API_PROXY_TARGET`.

> **API proxy target.** Docker Compose sets `API_PROXY_TARGET=http://backend:8000`
> (the backend *service* name) — inside the containers, `localhost` refers to the
> frontend container, not the backend. The default in `.env.example` is already
> `http://backend:8000`, so the Docker path needs no manual edit. Only when you
> run the frontend **manually on your host** (outside Docker) should you set
> `API_PROXY_TARGET=http://localhost:8000`.

## 6. Backend dependencies without Docker

Requires **Python 3.12+** (the Docker image uses 3.13) and a reachable PostgreSQL
database. The simplest way to get PostgreSQL is to run just the `db` service with
`docker compose up db`, or use any local PostgreSQL instance.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate

# Install from pyproject.toml. The [dev] extra adds pytest, ruff, mypy, etc.
pip install -e ".[dev]"          # runtime only: pip install -e .

# Point DATABASE_URL at your PostgreSQL (example: the docker db on host port 5433,
# or your own instance). Then:
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

There is no `requirements.txt`; all Python dependencies come from
`backend/pyproject.toml`.

## 7. Environment variables

- Copy the template: `cp .env.example .env`.
- For local Docker use, the defaults in `.env.example` work as-is.
- For production, set real values (see [DEPLOYMENT.md](DEPLOYMENT.md)):
  - `DJANGO_SECRET_KEY` — a strong unique secret.
  - `DATABASE_URL` (or `POSTGRES_*`) — your PostgreSQL connection.
  - `PATIENT_FIELD_KEY` and `PATIENT_INDEX_KEY` — required in production.
  - `BACKUP_ENCRYPTION_KEY` — enables encrypted backups (required by default in
    production); generate one with
    `docker compose exec backend python manage.py generate_backup_key`.
- **Never commit `.env`** — it is git-ignored.

## 8. Test commands

Frontend (via Docker Compose, or run from `frontend/` without the prefix):

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
in the virtual environment created in section 6:

```bash
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/mypy .
.venv/bin/python -m pytest
```

## 9. Common installation problems

- **Docker is not running** — start Docker Desktop / the Docker daemon, then
  retry `docker compose up --build`. Check `docker compose ps`.
- **Port 5173 or 8000 already in use** — stop the other process, or change the
  published port in a local `docker-compose.override.yml`.
- **Database not ready yet** — the backend waits for the `db` healthcheck; if a
  command fails immediately after `up`, wait until `docker compose ps` shows `db`
  as `healthy`, then retry.
- **Missing `.env`** — run `cp .env.example .env` before `docker compose up`.
- **`node_modules` missing** (running the frontend without Docker) — run
  `npm ci` in `frontend/`.
- **Backend dependencies missing** (running the backend without Docker) — create
  and activate the virtual environment and run `pip install -e ".[dev]"` in
  `backend/`.
- **A feature errors with "column ... does not exist"** — migrations have not been
  applied. Run `docker compose exec backend python manage.py migrate`.
- **Demo data missing / need the exact demo database** — run `seed_demo`, or
  restore the supplied SQL dump using
  [DEMO_DATABASE_RESTORE.md](DEMO_DATABASE_RESTORE.md).
- **Frontend loads but API calls fail under Docker** — ensure
  `API_PROXY_TARGET=http://backend:8000` in `.env` (this is the default in
  `.env.example`). `http://localhost:8000` does not work from inside the frontend
  container, because `localhost` there is the frontend container itself.
- **Frontend build fails with a Rolldown / native binding error** — rebuild the
  frontend image cleanly:
  ```bash
  docker compose build --no-cache frontend
  docker compose up -d
  ```

## 10. Final submission note

- `node_modules/` and `.venv/` are intentionally excluded from the source zip.
- Dependencies are recreated from the manifest files: `backend/pyproject.toml`
  for Python, and `frontend/package.json` + `frontend/package-lock.json` for Node.
- The demo database dump is provided **separately** (if required); the source zip
  contains code and manifests only.
