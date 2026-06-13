# Deployment Guide

## Option A — Docker Compose (recommended)

```bash
docker compose up --build -d
```

Services:

| Service | Image | Port | Notes |
|---|---|---|---|
| `db` | postgres:18 | internal | volume `pgdata18` persists data |
| `redis` | redis:8 | internal | reserved for roadmap background jobs |
| `backend` | built from `./backend` | 8000 | gunicorn; auto-migrates & seeds on first boot |
| `frontend` | built from `./frontend` | 8080 | nginx serves the SPA and proxies `/api/` |

Then open <http://localhost:8080>. To **disable auto-seeding**, set `SEED_ON_START=false` on the
backend service.

PostgreSQL 18 uses a new versioned data-directory layout. Back up and migrate any existing
PostgreSQL 16 `pgdata` volume before starting this Compose stack; the new stack deliberately uses
`pgdata18` so an older database is never overwritten or attached accidentally.

### Production hardening checklist

- Set a strong `DJANGO_SECRET_KEY` and `DJANGO_DEBUG=False` (security middleware, HSTS, secure
  cookies and SSL redirect switch on automatically when DEBUG is false).
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
| `DJANGO_DEBUG` | `True` | `False` enables security hardening |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | comma-separated hosts |
| `DATABASE_URL` | SQLite file | Postgres URL in production |
| `CORS_ALLOWED_ORIGINS` | localhost dev origins | SPA origins |
| `ACCESS_TOKEN_LIFETIME_MIN` | `30` | JWT access lifetime |
| `REFRESH_TOKEN_LIFETIME_DAYS` | `1` | JWT refresh lifetime |
| `SEED_ON_START` | `true` | seed demo data on container boot |
