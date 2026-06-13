# Deployment Guide

## Option A — Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Services:

| Service | Image | Port | Notes |
|---|---|---|---|
| `db` | postgres:18 | 5432 | volume `pgdata18` persists data |
| `pgadmin` | dpage/pgadmin4:9.15 | 5050 | browser database dashboard; preloads the project server |
| `redis` | redis:8 | internal | reserved for roadmap background jobs |
| `backend` | built from `./backend` | 8000 | gunicorn; auto-migrates & seeds on first boot |
| `frontend` | built from `./frontend` | 8080 | nginx serves the SPA and proxies `/api/` |

Then open <http://localhost:8080>. pgAdmin is available at <http://localhost:5050> and uses the
`PGADMIN_EMAIL` and `PGADMIN_PASSWORD` values from `.env`. To **disable auto-seeding**, set
`SEED_ON_START=false` on the backend service.

The preloaded pgAdmin connection is under **AI Pharmacy Manager → AI Pharmacy PostgreSQL**. The
PostgreSQL host port and pgAdmin are bound to `127.0.0.1` by default; containers use the internal
Compose network and database host `db`.

### Day-to-day Docker commands

```bash
docker compose logs -f backend
docker compose logs -f pgadmin
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed
docker compose exec backend python manage.py createsuperuser
docker compose exec backend pytest
docker compose stop
docker compose down
```

`docker compose down` retains PostgreSQL data. Use `docker compose down --volumes` only when you
intend to erase the database and start again from an empty volume.

PostgreSQL 18 uses a new versioned data-directory layout. Back up and migrate any existing
PostgreSQL 16 `pgdata` volume before starting this Compose stack; the new stack deliberately uses
`pgdata18` so an older database is never overwritten or attached accidentally.

### Production hardening checklist

- Set a strong `DJANGO_SECRET_KEY` and `DJANGO_DEBUG=False`.
- Behind HTTPS, set `DJANGO_SECURE_SSL_REDIRECT=True`, `DJANGO_SECURE_COOKIES=True` and a suitable
  non-zero `DJANGO_HSTS_SECONDS` value.
- Set `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` to your real domains.
- Use managed PostgreSQL with backups; supply `DATABASE_URL`.
- Terminate TLS at a load balancer / ingress and forward `X-Forwarded-Proto`.
- Set `SEED_ON_START=false` for real deployments.
- Run `python manage.py createsuperuser` for admin access.

## Option B — manual / PaaS

**Backend** (any WSGI host, e.g. Render, Railway, Fly, a VM):

```bash
pip install -r backend/requirements.txt
export DATABASE_URL=postgres://…  DJANGO_DEBUG=False  DJANGO_SECRET_KEY=…
python backend/manage.py migrate
python backend/manage.py collectstatic --noinput
gunicorn config.wsgi:application --chdir backend --bind 0.0.0.0:8000
```

WhiteNoise serves static files, so no separate static host is required for the API/admin.

**Frontend** (any static host / CDN):

```bash
cd frontend
npm ci
VITE_API_TARGET=https://api.example.com npm run build   # outputs dist/
```

Serve `dist/` and reverse-proxy `/api/` to the backend (see `frontend/nginx.conf` for a reference
config), or point the SPA at an absolute API origin.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | dev value | **Change in production** |
| `DJANGO_DEBUG` | `True` | must be `False` in production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | comma-separated hosts |
| `DJANGO_SECURE_SSL_REDIRECT` | `False` | redirect HTTP requests to HTTPS |
| `DJANGO_SECURE_COOKIES` | `False` | require HTTPS for session and CSRF cookies |
| `DJANGO_HSTS_SECONDS` | `0` | HSTS lifetime when debug is disabled |
| `DATABASE_URL` | required | PostgreSQL URL; all other engines are rejected |
| `POSTGRES_DB` | `pharmacy` | Compose PostgreSQL database name |
| `POSTGRES_USER` | `pharma` | Compose PostgreSQL user |
| `POSTGRES_PASSWORD` | `pharma` | Compose PostgreSQL password; change outside local development |
| `POSTGRES_PORT` | `5433` | localhost port exposed by Compose (`5432` remains the container port) |
| `PGADMIN_EMAIL` | `admin@example.com` | local pgAdmin login email |
| `PGADMIN_PASSWORD` | `PgAdmin123!` | local pgAdmin login password; change outside local development |
| `PGADMIN_PORT` | `5050` | localhost-only pgAdmin dashboard port |
| `CORS_ALLOWED_ORIGINS` | localhost dev origins | SPA origins |
| `ACCESS_TOKEN_LIFETIME_MIN` | `30` | JWT access lifetime |
| `REFRESH_TOKEN_LIFETIME_DAYS` | `1` | JWT refresh lifetime |
| `LOGIN_THROTTLE_RATE` | `10/min` | per-client throttle for login attempts |
| `SEED_ON_START` | `true` | seed demo data on container boot |
