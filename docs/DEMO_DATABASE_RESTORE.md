# Demo Database Restore

## Purpose of this guide

This guide explains how to load the project's **demo database** onto another
computer so the application shows the same fictional demo data used in the
demonstration. It is written to be followed step by step, without prior
knowledge of the tools.

The application's database is **PostgreSQL**. It runs inside Docker as the `db`
service. (SQLite is not used as the application database.)

## Two separate files

The submission has two parts that do different jobs:

| File | What it is | What it contains |
| --- | --- | --- |
| `ai-pharmacy-manager-AT3.zip` | The **source code** | The application's tracked source code, configuration, and documentation. **It does not contain any database data.** |
| `ai-pharmacy-manager-demo-database.sql` | The **database dump** | A snapshot of the PostgreSQL demo database (schema + fictional demo data), created with `pg_dump`. |

To reproduce the running demo on a new machine you need **both**: the source
code to run the app, and the database dump to load the demo data.

### What the source-code zip contains

The zip was produced with `git archive`, so it includes only committed, tracked
files — the backend and frontend code, Docker files, configuration templates,
and the `docs/` documentation. It **excludes** `node_modules/`, virtual
environments, caches, build output, the live database, and any local-only files.

### What the database dump contains

The `.sql` dump contains the PostgreSQL schema (tables) and the **fictional demo
records** — demo users, pharmacies, medications, stock, patients, dosette
cycles, and so on — as they existed when the dump was taken.

> ⚠️ **Fictional / synthetic data only.** The demo database contains fictional
> data created for demonstration. **Do not submit or share a database that
> contains real patient data.** Never replace the demo data with real records.

## How to create the database dump (from the current system)

Run this from the project folder while the Docker stack is running. It writes the
dump to the folder **above** the project (next to the AT3 zip):

```bash
docker compose exec -T db pg_dump \
  -U pharmacy \
  -d pharmacy \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  > ../ai-pharmacy-manager-demo-database.sql
```

- `--clean --if-exists` makes the dump drop existing objects before recreating
  them, so a restore is repeatable.
- `--no-owner --no-privileges` keeps the dump portable between machines.

## How to restore the database on another system

On the new computer:

1. **Unzip the source code** and open a terminal in the project folder.
2. **Create the environment file** (defaults are fine for a local demo):
   ```bash
   cp .env.example .env
   ```
   No manual edits are needed — the template already points the frontend proxy at
   the `backend` service (`API_PROXY_TARGET=http://backend:8000`), which is what
   Docker Compose requires.
3. **Start the stack** (this also creates an empty `pharmacy` database):
   ```bash
   docker compose up --build -d
   ```
4. **Load the demo data** from the dump file (adjust the path if you saved it
   somewhere else):
   ```bash
   cat ../ai-pharmacy-manager-demo-database.sql | docker compose exec -T db psql -U pharmacy -d pharmacy
   ```

Because the dump was created with `--clean --if-exists`, this restore is safe to
run even if the database already has tables — it drops and recreates them from
the dump. You do **not** need to run `seed_demo` after restoring; the demo data
is already in the dump.

## If the database does not exist

The Docker `db` service normally creates the `pharmacy` database automatically.
If you see an error that the database does not exist, create it first, then
restore:

```bash
docker compose exec -T db createdb -U pharmacy pharmacy
cat ../ai-pharmacy-manager-demo-database.sql | docker compose exec -T db psql -U pharmacy -d pharmacy
```

## How to start the app after the restore

If it is not already running:

```bash
docker compose up --build -d
```

Then open the app in a browser:

- **Frontend (the app):** <http://localhost:5173>
- **Backend API:** <http://localhost:8000> (health check at
  <http://localhost:8000/api/health/>)

The `db` service is the PostgreSQL runtime database and runs inside Docker.

## Demo login credentials

All demo accounts share one **demo-only** password.

> **Demo-only credentials — do not use in production.**

Shared password: `DemoPass!2026`

| Email | Role |
| --- | --- |
| `admin@demo.local` | Admin |
| `superintendent@demo.local` | Superintendent |
| `pharmacist@demo.local` | Pharmacist |
| `dispenser@demo.local` | Dispenser |
| `stock@demo.local` | Stock employee |

## How to verify the restore worked

1. Open <http://localhost:5173> and **log in** as `admin@demo.local` with the
   demo password.
2. Check that the demo data is present:
   - **Patients** — demo patient records are listed.
   - **Inventory** — stock items and batches are shown.
   - **Dosette / MDS** — dosette cycles appear for patients.
   - **Stock Intelligence** — the overview and signals display data.
3. Signing in with the other demo roles (e.g. `pharmacist@demo.local`) should
   show the same data within that role's scope.

If all of the above appear, the restore was successful.

## Optional: restore with pgAdmin

If you prefer a graphical tool instead of the command line:

1. Install and open **pgAdmin** and connect to the PostgreSQL server. For the
   Docker `db` service you would first publish or forward its port (it is not
   published to the host by default), then connect with host `localhost`,
   database `pharmacy`, user `pharmacy`, and the password from your `.env`
   (`POSTGRES_PASSWORD`, default `pharmacy`).
2. Because the dump is a **plain SQL file**, use pgAdmin's **Query Tool**: open
   the `ai-pharmacy-manager-demo-database.sql` file and run it against the
   `pharmacy` database. (pgAdmin's "Restore" dialog is for custom-format
   archives, not plain SQL files.)

The command-line method above is the simplest and is recommended.

## Troubleshooting

- **"database ... does not exist"** — create it first, then restore (see
  [If the database does not exist](#if-the-database-does-not-exist)).
- **"Cannot connect" / commands hang** — the Docker containers are not running.
  Start them with `docker compose up --build -d` and check `docker compose ps`.
  The `db` service should be healthy before you restore.
- **Permission errors during restore** — make sure you use `-U pharmacy` and the
  matching credentials from `.env`. The dump uses `--no-owner --no-privileges`,
  so it does not require the exact original roles.
- **The app still shows old / different data after restoring** — the dump's
  `--clean --if-exists` clauses drop and recreate the tables, so re-running the
  restore command replaces the data with the dump's contents. Refresh the browser
  after the restore completes.
- **After restoring, the app reports pending migrations** — this only happens if
  the source code is newer than the dump. Apply migrations with
  `docker compose exec backend python manage.py migrate`.
- **Frontend build fails with a Rolldown / native binding error** — rebuild the
  frontend image cleanly, then start again:
  ```bash
  docker compose build --no-cache frontend
  docker compose up -d
  ```

## Suggested AT3 submission bundle

Submit these together so the demo can be reproduced:

1. **`ai-pharmacy-manager-AT3.zip`** — the source code (from `git archive`).
2. **`ai-pharmacy-manager-demo-database.sql`** — the PostgreSQL demo database
   dump (fictional data only).
3. **`README.md`** (inside the zip) — setup instructions, plus this guide at
   `docs/DEMO_DATABASE_RESTORE.md` for restoring the demo database.
