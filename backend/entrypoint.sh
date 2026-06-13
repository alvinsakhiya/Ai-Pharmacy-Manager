#!/usr/bin/env bash
set -e

echo "Waiting for PostgreSQL..."
python - <<'PY'
import os
import sys
import time

import dj_database_url
import psycopg

database_url = os.getenv("DATABASE_URL")
if not database_url:
    sys.exit("DATABASE_URL is required")

config = dj_database_url.parse(database_url)
if config.get("ENGINE") != "django.db.backends.postgresql":
    sys.exit("PostgreSQL is required")

last_error = None
for _ in range(30):
    try:
        psycopg.connect(database_url, connect_timeout=3).close()
        print("PostgreSQL ready.")
        break
    except psycopg.Error as exc:
        last_error = exc
        time.sleep(1)
else:
    sys.exit(f"PostgreSQL not reachable: {last_error}")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput || true

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "Seeding demo data (idempotent)…"
  python manage.py seed || echo "Seed skipped/failed (continuing)."
fi

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
