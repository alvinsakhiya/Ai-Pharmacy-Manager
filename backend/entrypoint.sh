#!/usr/bin/env bash
set -e

echo "Waiting for database…"
python - <<'PY'
import os, time, sys
import dj_database_url
cfg = dj_database_url.parse(os.getenv("DATABASE_URL", ""))
if cfg.get("ENGINE", "").endswith("postgresql"):
    import psycopg2
    for _ in range(30):
        try:
            psycopg2.connect(
                dbname=cfg["NAME"], user=cfg["USER"], password=cfg["PASSWORD"],
                host=cfg["HOST"], port=cfg["PORT"] or 5432,
            ).close()
            break
        except Exception:
            time.sleep(1)
    else:
        sys.exit("Database not reachable")
print("Database ready.")
PY

echo "Generating migrations…"
python manage.py makemigrations accounts core patients stock dosette picking notifications reports --noinput
python manage.py migrate --noinput
python manage.py collectstatic --noinput || true

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "Seeding demo data (idempotent)…"
  python manage.py seed || echo "Seed skipped/failed (continuing)."
fi

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
