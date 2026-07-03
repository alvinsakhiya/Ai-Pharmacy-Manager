# Oracle Always Free VM Deployment (Synthetic Demo)

How to run AI Pharmacy Manager as a **secure, no-cost public demo** on an Oracle
Cloud **Always Free** virtual machine using Docker Compose, with PostgreSQL kept
internal-only and optional free HTTPS via DuckDNS + Caddy.

> **Scope and honesty.** This guide is for a **synthetic/demo-data** deployment
> only. The app ships with fictional `@demo.local` data and makes no NHS/NCRS,
> clinical, or regulatory claims. It is **not** suitable for real patient data:
> that would require professional security review, a DPIA, a hosting agreement,
> clinical governance, penetration testing, an approved backup policy,
> monitoring, and an incident-response process (see
> [Limitations](#12-limitations)).

## Contents

1. [Architecture](#1-architecture)
2. [Firewall and ports](#2-firewall-and-ports)
3. [Install Docker and Compose](#3-install-docker-and-docker-compose)
4. [Production environment variables](#4-production-environment-variables)
5. [Generating the secret keys](#5-generating-the-secret-keys)
6. [DATABASE_URL for internal PostgreSQL](#6-database_url-for-internal-postgresql)
7. [HTTPS with DuckDNS + Caddy (optional)](#7-https-with-duckdns--caddy-optional)
8. [Start the stack and restore the demo database](#8-start-the-stack-and-restore-the-demo-database)
9. [Backup and restore](#9-backup-and-restore)
10. [Security checklist](#10-security-checklist)
11. [Post-deployment test checklist](#11-post-deployment-test-checklist)
12. [Limitations](#12-limitations)

## 1. Architecture

A single Always Free VM runs the whole stack with Docker Compose. Only the
reverse proxy is exposed to the internet; the application and database are on a
private Docker network.

```
Internet ──80/443──▶ Caddy (reverse proxy, auto-HTTPS)
                         │  serves built frontend, proxies /api → backend
                         ▼
                     backend (Django + production WSGI server)  :8000 (internal)
                         │
                         ▼
                     db (PostgreSQL 17)  :5432 (internal only — never published)
```

- **Why Oracle Always Free:** the Always Free tier includes small always-on VM
  instances suitable for a long-running, low-traffic demo at no cost — useful for
  a COM668 demonstration that needs to stay reachable.
- **Honest limitation:** Always Free capacity, idle-reclaim, and account policies
  can change and are **not** an enterprise SLA. Treat availability as best-effort
  and keep an off-VM copy of your data and keys.

**Files in this repo that support this deployment (all templates):**

- [`docker-compose.prod.yml`](../docker-compose.prod.yml) — production Compose
  file (internal-only DB, gunicorn backend, frontend built into the Caddy
  image, restart policies, healthchecks).
- [`Caddyfile.example`](../Caddyfile.example) — reverse proxy + automatic HTTPS.
- [`scripts/deploy/check-production-env.sh`](../scripts/deploy/check-production-env.sh)
  — pre-deploy check that required secrets are set and not left at dev defaults.
- [`docs/OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md) — day-to-day operations
  (logs, health, restarts, backups, updates) after the initial deployment.

## 2. Firewall and ports

Two firewalls apply on Oracle VMs: the **cloud Security List / NSG** and the
**instance OS firewall**. Open ports in *both*.

| Port | Exposure | Purpose |
| --- | --- | --- |
| 22 (SSH) | **Restricted** — your IP only | Administration |
| 80 (HTTP) | Public | Redirects to HTTPS / ACME challenge |
| 443 (HTTPS) | Public | The application |
| 5432 (PostgreSQL) | **Never public** | Internal Docker network only |
| 8000 (backend) | **Never public** | Internal Docker network only |

**Cloud Security List:** in the Oracle console, add ingress rules for 80 and 443
from `0.0.0.0/0`, and restrict 22 to your own IP (e.g. `203.0.113.10/32`). Do
**not** add a rule for 5432 or 8000.

**Instance firewall (Ubuntu image, iptables):** Oracle Ubuntu images ship with a
restrictive iptables config. Allow 80/443 and keep SSH limited:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save     # persist across reboots
```

Restrict SSH to your IP in the Oracle Security List (preferred) rather than
opening 22 to the world. Never open 5432/8000 in either firewall — Compose keeps
them on the internal network only (no `ports:` mapping for `db`/`backend` in the
production override).

## 3. Install Docker and Docker Compose

On the VM (Ubuntu example):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"   # log out/in for group to apply
docker --version && docker compose version
```

Then clone the repository and change into it:

```bash
git clone <your-repo-url> ai-pharmacy-manager
cd ai-pharmacy-manager
```

## 4. Production environment variables

Create a `.env` on the VM (never commit it — it is git-ignored). Use
`.env.example` as the template. The production-critical variables:

| Variable | Required | Notes |
| --- | --- | --- |
| `DJANGO_SETTINGS_MODULE` | Yes | `config.settings.prod` |
| `DJANGO_SECRET_KEY` | Yes | Strong random value (prod refuses the dev default) |
| `PATIENT_FIELD_KEY` | Yes | Fernet key (prod refuses the dev default) |
| `PATIENT_INDEX_KEY` | Yes | Random value (prod refuses the dev default) |
| `BACKUP_ENCRYPTION_KEY` | Yes | base64 32-byte key; prod requires encrypted backups |
| `DATABASE_URL` | Yes | Internal Postgres URL (see §6) |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Yes | Use a strong DB password (not `pharmacy`) |
| `DJANGO_ALLOWED_HOSTS` | Yes | e.g. `your-app.duckdns.org` |
| `CSRF_TRUSTED_ORIGINS` | Yes | e.g. `https://your-app.duckdns.org` |
| `CORS_ALLOWED_ORIGINS` | Yes | Same-origin deployment: your HTTPS URL |
| `DJANGO_DEBUG` | — | Leave unset/`False`; prod forces `DEBUG=False` |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | — | Prod forces both `True` |
| `LOG_LEVEL` | Optional | `INFO` (default) or `WARNING` |
| `SESSION_COOKIE_AGE` | Optional | Seconds; default 12h |

> **Same-origin requirement.** Serve the frontend and API from the **same
> host/origin** (Caddy does this). A cross-origin `VITE_API_BASE_URL` breaks CSRF
> and the session cookie.

Before starting, verify the environment with the bundled check script:

```bash
set -a && . ./.env && set +a
./scripts/deploy/check-production-env.sh
```

## 5. Generating the secret keys

Generate each secret **on the VM** (or your machine) and paste into `.env`. Never
commit them; store copies in a password manager.

The first three commands are self-contained (they need no `.env` and no
application image, so they work before the stack exists):

```bash
# DJANGO_SECRET_KEY (a long random string)
docker run --rm python:3.13-slim python -c \
  "import secrets; print(secrets.token_urlsafe(64))"

# PATIENT_FIELD_KEY (Fernet)
docker run --rm python:3.13-slim sh -c \
  "pip install -q cryptography && python -c \
   'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"

# PATIENT_INDEX_KEY (random)
openssl rand -base64 48
```

Paste those (and the database values from §4/§6) into `.env` **first**, then
generate the backup key through the production stack — it loads the production
settings, which require the values above to be present:

```bash
# BACKUP_ENCRYPTION_KEY (AES-256-GCM)
docker compose -f docker-compose.prod.yml run --rm --no-deps backend \
  python manage.py generate_backup_key
```

The production settings **refuse to start** if `DJANGO_SECRET_KEY`,
`PATIENT_FIELD_KEY`, `PATIENT_INDEX_KEY`, or `DATABASE_URL` are unset or left at a
dev default — this is intentional fail-fast behaviour.

## 6. DATABASE_URL for internal PostgreSQL

PostgreSQL runs as the `db` service and is reachable only inside the Docker
network. Point `DATABASE_URL` at the service name, **not** a public address:

```
DATABASE_URL=postgresql://pharmacy:<STRONG_DB_PASSWORD>@db:5432/pharmacy
```

Set `POSTGRES_PASSWORD` to the same strong value. The production Compose override
publishes **no** host port for `db`, so PostgreSQL is never reachable from the
internet.

## 7. HTTPS with DuckDNS + Caddy (optional)

Free HTTPS without owning a domain:

1. **DuckDNS:** create a free subdomain at <https://www.duckdns.org> (e.g.
   `your-app.duckdns.org`) and point it at the VM's public IP.
2. **Caddy** obtains and renews a Let's Encrypt certificate automatically. Copy
   `Caddyfile.example` to `Caddyfile`, replace the placeholder domain and email,
   and run Caddy as part of the stack (see the override file).
3. Set `DJANGO_ALLOWED_HOSTS=your-app.duckdns.org` and
   `CSRF_TRUSTED_ORIGINS=https://your-app.duckdns.org`.

**If you have no domain at all:** you can reach the app over `http://<VM-IP>`,
but this is **less secure** — cookies are not `Secure` over plain HTTP and
production forces secure cookies, so login will not work over HTTP. For any real
demo, use HTTPS (DuckDNS + Caddy is free).

## 8. Start the stack and restore the demo database

Start (or rebuild) the production stack. The build compiles the frontend SPA
(`npm ci && npm run build`) into the Caddy image, so **no Node.js is needed on
the VM**, and the backend applies migrations before gunicorn starts:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

> Local development uses `docker-compose.yml` (Vite dev server + `runserver`);
> the production demo uses **only** `docker-compose.prod.yml`. Always pass
> `-f docker-compose.prod.yml` on the VM so commands target the right stack.

The demo data is fictional. Load it either by seeding or by restoring a dump:

```bash
# Option A: seed fictional demo data (migrations already ran on start-up)
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_demo

# Option B: restore a supplied SQL dump (see the dedicated guide)
```

Full restore steps (including "database does not exist" and verification) are in
[DEMO_DATABASE_RESTORE.md](DEMO_DATABASE_RESTORE.md). After restoring, **rotate or
disable the demo accounts** before the site is public (see §10).

## 9. Backup and restore

Backups are encrypted at rest (AES-256-GCM) and, in production, required.

```bash
# Create an encrypted backup (admin/pharmacist)
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py run_scheduled_backups   # or via the UI

# Archives live in the backend_media volume, not on the VM filesystem.
# Copy one out of the volume onto the VM…
docker compose -f docker-compose.prod.yml cp \
  backend:/app/media/backups/<group-slug>/<archive>.zip.enc ~/

# …then pull it OFF the VM to durable storage (run from your machine)
scp opc@<VM-IP>:~/<archive>.zip.enc ./
```

- Keep `BACKUP_ENCRYPTION_KEY` **separate** from the archives — without it,
  encrypted backups cannot be restored.
- Also take database-level snapshots (`pg_dump`) for full recovery.
- Full details: [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md).

## 10. Security checklist

- [ ] Only 80/443 public; 22 restricted to your IP; 5432/8000 never exposed.
- [ ] HTTPS enabled (Caddy + DuckDNS); HTTP redirects to HTTPS.
- [ ] `DJANGO_SETTINGS_MODULE=config.settings.prod` (forces `DEBUG=False`, secure
      cookies, HSTS, SSL redirect).
- [ ] Strong unique `DJANGO_SECRET_KEY`, `PATIENT_FIELD_KEY`, `PATIENT_INDEX_KEY`,
      `BACKUP_ENCRYPTION_KEY` — none left at dev defaults.
- [ ] Strong `POSTGRES_PASSWORD` (not `pharmacy`); `DATABASE_URL` points at `db`.
- [ ] `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS` set
      to your real HTTPS origin.
- [ ] `./scripts/deploy/check-production-env.sh` passes.
- [ ] **Demo accounts rotated or disabled** — change the shared `DemoPass!2026`
      and disable/remove `@demo.local` users (especially `admin@demo.local`).
- [ ] `.env` present on the VM, never committed; secrets stored off-VM too.
- [ ] OS kept updated (`sudo apt-get update && sudo apt-get upgrade`).

## 11. Post-deployment test checklist

- [ ] `https://your-app.duckdns.org` loads over HTTPS (valid certificate).
- [ ] `GET /api/health/` returns `{"status": "ok"}`.
- [ ] Login works for a demo role (after rotating the password).
- [ ] An unauthenticated request to a protected endpoint returns 401/403.
- [ ] Inventory, patients, dosette, stock intelligence, and reports load with the
      demo data.
- [ ] The patients page respects roles: a role without patient access sees the
      access-denied state, not data.
- [ ] Settings → Backup & restore: restore controls appear only for an admin.
- [ ] Logout returns to login and shows no cached data from the session.
- [ ] Creating an encrypted backup succeeds and the archive is `*.zip.enc`.
- [ ] `docker compose -f docker-compose.prod.yml logs` shows no tracebacks;
      container logs capture requests.
- [ ] PostgreSQL is not reachable from the internet (`nc -vz <VM-IP> 5432` fails).

Day-to-day commands (logs, restarts, backups, updates) are collected in the
[operations runbook](OPERATIONS_RUNBOOK.md).

## 12. Limitations

- Suitable for a **synthetic-data public demo** with the hardening in this repo.
- **Not** suitable for real patient data. Before any real-patient use you would
  need professional security review, a DPIA, a hosting/data-processing agreement,
  clinical governance sign-off, penetration testing, an approved backup and
  retention policy, monitoring/alerting, and a documented incident-response
  process. This project makes no production-certification, NHS/NCRS, or clinical
  claim.
- Oracle Always Free resources are best-effort and may be reclaimed; keep off-VM
  copies of data and keys.
