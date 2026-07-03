# Operations Runbook (Synthetic-Data Demo)

Day-to-day operational commands for the production demo stack described in
[ORACLE_FREE_VM_DEPLOYMENT.md](ORACLE_FREE_VM_DEPLOYMENT.md).

> **Scope.** This runbook covers a **synthetic-data public demo** on a single
> VM. It is not an operations manual for real-patient production use — see the
> limitations in [ORACLE_FREE_VM_DEPLOYMENT.md](ORACLE_FREE_VM_DEPLOYMENT.md#12-limitations).

All commands run **on the VM, from the repository root**. The production stack
is always addressed with `-f docker-compose.prod.yml`; plain `docker compose`
commands target the local development stack (`docker-compose.yml`) instead and
will not see the production containers.

## 1. Stack at a glance

| Service | Runs | Exposure |
| --- | --- | --- |
| `caddy` | Reverse proxy + built frontend SPA | **Only public service** — ports 80/443 |
| `backend` | Django API under gunicorn (non-root) | Internal network only |
| `db` | PostgreSQL 17 | Internal network only — never published |

| Volume | Contents | Losing it means |
| --- | --- | --- |
| `postgres_data` | The PostgreSQL database | All application data gone |
| `backend_media` | `media/` incl. **encrypted backup archives** (`media/backups/<group-slug>/`) | All in-app backup archives gone |
| `caddy_data` / `caddy_config` | TLS certificates + Caddy state | Certificates re-issued on next start |

## 2. Checking containers

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected: `db` and `backend` **healthy**, `caddy` running. A backend stuck in
`starting`/`unhealthy` usually means missing/invalid environment values — check
its logs (below) and re-run `./scripts/deploy/check-production-env.sh`.

## 3. Viewing logs

```bash
# Backend (Django/gunicorn — application and security records)
docker compose -f docker-compose.prod.yml logs backend --since 1h

# Follow live
docker compose -f docker-compose.prod.yml logs -f backend

# Caddy (TLS, requests reaching the proxy)
docker compose -f docker-compose.prod.yml logs caddy --since 1h

# PostgreSQL
docker compose -f docker-compose.prod.yml logs db --since 1h
```

- All logs go to container stdout; nothing is written inside the containers.
- Verbosity is controlled by `LOG_LEVEL` in `.env` (`INFO` default, `WARNING`
  for quieter logs). Change it, then `up -d` to apply.
- Logs are expected to contain **no secrets and no patient field values**. If
  you ever see either, treat it as a defect and stop sharing the log output.

## 4. Checking health

```bash
# From anywhere (through Caddy/HTTPS)
curl -fsS https://your-app.duckdns.org/api/health/   # -> {"status": "ok"}

# Container-level health state (uses the same endpoint internally)
docker inspect --format '{{.State.Health.Status}}' \
  "$(docker compose -f docker-compose.prod.yml ps -q backend)"
```

The health endpoint is unauthenticated by design and returns only the static
body `{"status": "ok"}` — no version, configuration, or database details.

## 5. Restarting safely

```bash
# Restart one service (containers only; data volumes are untouched)
docker compose -f docker-compose.prod.yml restart backend

# Apply .env or compose-file changes (recreates what changed)
docker compose -f docker-compose.prod.yml up -d

# Stop the stack WITHOUT deleting data
docker compose -f docker-compose.prod.yml down
```

> ⚠️ **Never run `docker compose down -v`** unless you intentionally want to
> **wipe the database, all encrypted backup archives, and the TLS
> certificates**. The `-v` flag deletes the named volumes listed in §1. There
> is no undo.

## 6. Migrations

Migrations run automatically before gunicorn starts (the backend service
command is `migrate --noinput && gunicorn …`), so a normal `up -d --build`
already applies them. To run or verify manually:

```bash
# Apply pending migrations
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput

# Show migration state (all entries should be [X])
docker compose -f docker-compose.prod.yml exec backend python manage.py showmigrations
```

## 7. Backups

Archives are encrypted (AES-256-GCM, required in production) and stored in the
`backend_media` volume at `/app/media/backups/<group-slug>/` inside the backend
container. They are **not** on the VM filesystem directly and are never served
over HTTP.

```bash
# Create a backup (or use the Settings → Backup & restore page as admin)
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py run_scheduled_backups

# List archives
docker compose -f docker-compose.prod.yml exec backend \
  ls -lR /app/media/backups/

# Copy an archive out of the volume onto the VM…
docker compose -f docker-compose.prod.yml cp \
  backend:/app/media/backups/<group-slug>/<archive>.zip.enc ~/

# …then pull it OFF the VM to durable storage (run from your machine)
scp opc@<VM-IP>:~/<archive>.zip.enc ./
```

- Keep `BACKUP_ENCRYPTION_KEY` stored **separately** from the archives (password
  manager, not on the VM disk next to them). Without the key, archives cannot
  be restored — with only the key and an off-VM archive, they can.
- Restoring is **admin-only**, requires typed confirmation in the UI, and takes
  a pre-restore safety backup first — full steps in
  [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md).
- For belt-and-braces recovery also take periodic database snapshots:

```bash
docker compose -f docker-compose.prod.yml exec db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > demo-snapshot.sql
```

## 8. Disk usage

The Always Free VM disk is small; check it periodically:

```bash
df -h /                      # VM disk overall
docker system df             # images / containers / volumes breakdown
docker image prune -f        # safe: removes only dangling images
```

Do **not** use `docker system prune --volumes` or `docker volume prune` — they
can delete the data volumes in §1.

## 9. Updating the deployment from GitHub

```bash
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
```

The build compiles the frontend SPA into the Caddy image and the backend
applies migrations on start. Data volumes are untouched. Afterwards, run the
verification checklist below.

## 10. Post-deployment verification checklist

- [ ] `https://your-app.duckdns.org` loads over HTTPS with a valid certificate.
- [ ] `GET /api/health/` returns `{"status": "ok"}`.
- [ ] Login works for a demo role (rotated password, not the shipped one).
- [ ] The dashboard loads with data.
- [ ] The patients page respects roles: permitted roles see it; a role without
      patient access gets the access-denied state, not data.
- [ ] The inventory/stock page loads.
- [ ] A patient's dosette page loads.
- [ ] Settings → Backup & restore: restore controls are available only to an
      admin account.
- [ ] Logout returns to the login screen and going Back shows no cached data;
      a stale session gets redirected to login rather than a stuck page.
- [ ] PostgreSQL is not reachable from the internet: `nc -vz <VM-IP> 5432`
      fails (and 8000 likewise).

## Related documents

- [ORACLE_FREE_VM_DEPLOYMENT.md](ORACLE_FREE_VM_DEPLOYMENT.md) — initial deployment
- [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md) — backup/restore details
- [DEMO_DATABASE_RESTORE.md](DEMO_DATABASE_RESTORE.md) — demo data restore
- [DEPLOYMENT.md](DEPLOYMENT.md) — environment variables and production checklist
