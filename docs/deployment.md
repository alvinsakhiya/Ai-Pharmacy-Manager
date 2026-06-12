# Deployment Guide

This project is structured as two deployable services:

- `backend`: Django REST API on Railway or Render
- `frontend`: React and Vite single-page application on Vercel

Use a managed PostgreSQL database. Never commit `.env` files or paste secrets
into source code.

## Production Environment Variables

Configure these variables on the backend hosting platform:

| Variable | Example | Purpose |
| --- | --- | --- |
| `DEBUG` | `False` | Disables Django debug output in production. |
| `SECRET_KEY` | generated value | Signs Django security data. Use a unique secret. |
| `ALLOWED_HOSTS` | `api.example.com` | Comma-separated backend hostnames without schemes. |
| `CORS_ALLOWED_ORIGINS` | `https://app.example.com` | Comma-separated frontend origins without trailing slashes. |
| `CSRF_TRUSTED_ORIGINS` | `https://api.example.com,https://app.example.com` | Trusted HTTPS origins for Django admin and CSRF-protected requests. |
| `DATABASE_URL` | platform-provided value | PostgreSQL connection URL supplied by Railway or Render. |
| `DB_SSL_REQUIRE` | `False` | Set to `True` when the database provider requires SSL. |
| `SECURE_SSL_REDIRECT` | `True` | Redirects HTTP requests to HTTPS. |

Optional security variables are `SESSION_COOKIE_SECURE`,
`CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS`,
`SECURE_HSTS_INCLUDE_SUBDOMAINS`, and `SECURE_HSTS_PRELOAD`. Their defaults are
safe for local development and enable secure cookies plus a one-hour HSTS
policy when `DEBUG=False`.

Generate a production secret locally:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

For local development, use the individual `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
`DB_HOST`, and `DB_PORT` variables shown in `backend/.env.example`.
`DATABASE_URL` takes precedence when it is set.

## Backend on Render

1. Create a PostgreSQL database and a Python web service from this repository.
2. Set the service root directory to `backend`.
3. Set the build command to `./build.sh`.
4. Set the start command to
   `gunicorn pharmacy_project.wsgi:application --bind 0.0.0.0:$PORT --access-logfile -`.
5. Add the production environment variables above. Use Render's internal
   database URL for `DATABASE_URL`.
6. Deploy and create an administrator with `python manage.py createsuperuser`
   from the Render shell.

The build script installs dependencies, collects WhiteNoise static files, and
applies database migrations.

## Backend on Railway

1. Create a Railway project from this GitHub repository and add PostgreSQL.
2. Set the backend service root directory to `backend`.
3. Set the build command to `./build.sh`.
4. Railway can use the included `Procfile` for the start command. If needed,
   set it explicitly to
   `gunicorn pharmacy_project.wsgi:application --bind 0.0.0.0:$PORT --access-logfile -`.
5. Map Railway's PostgreSQL connection URL to `DATABASE_URL`.
6. Add the remaining production environment variables and generate a public
   backend domain.

## Frontend on Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project root directory to `frontend`.
3. Keep the detected Vite build command (`npm run build`) and output directory
   (`dist`).
4. Add `VITE_API_BASE_URL` with the deployed backend API URL, for example
   `https://api.example.com/api`.
5. Deploy the frontend.

The included `frontend/vercel.json` routes deep links such as `/patients` back
to the React application.

After Vercel provides the production frontend URL, update
`CORS_ALLOWED_ORIGINS` on the backend and redeploy it. Keep the origin exact,
including `https://` and excluding a trailing slash.

## Production Verification

Run these commands before deployment:

```bash
cd backend
python manage.py test
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py check --deploy

cd ../frontend
npm run lint
npm run build
```

After deployment:

1. Confirm unauthenticated API requests return `401`.
2. Log in through Vercel and verify dashboard, patients, inventory, dosette,
   picking lists, expiry alerts, and forecasting.
3. Confirm a direct browser visit to a frontend route such as `/patients`
   loads correctly.
4. Confirm Django admin static files load over HTTPS.
5. Review hosting logs and create a database backup policy.

## Secret Rotation

If a real `.env` file was ever committed, removing it in a later commit does
not erase it from Git history. Rotate every credential that appeared in that
file before treating the deployment as secure. Rewriting repository history is
a separate disruptive operation and should only be performed with coordinated
approval.
