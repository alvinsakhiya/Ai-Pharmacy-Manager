# Industry Hardening Report — Post-AT3 Hardening Series

## 1. Scope

This report is the closing evidence package for the **post-AT3 hardening
series** carried out on the `post-at3-hardening` branch. The goal of the series
was **industry-style hardening** of the AI Pharmacy Manager prototype so that a
**synthetic-data public demo** can be deployed safely on a free cloud VM, with a
**production-aware deployment** posture (fail-fast settings, internal-only
database, TLS, least exposure).

**What this report is not.** It is not a production certification. The system
is **not** approved, reviewed, or certified for real patient data, and no
NHS/NCRS integration, clinical decision-making, or regulatory compliance is
claimed (see §6 and §7).

## 2. Phase summary

| Phase | Commit | Delivered |
| --- | --- | --- |
| 0 — Hardening audit | `7b5390c` | Read-only audit: 77 findings (0 blocker, 2 high, 27 medium, 26 low, 22 informational) with a per-phase remediation plan ([HARDENING_AUDIT.md](HARDENING_AUDIT.md)). |
| 1 — Production settings | `d8e9d00` | WSGI/ASGI entrypoints fail safe to `config.settings.prod`; fail-fast on missing/dev-default secrets; HSTS, SSL redirect, secure cookies, nosniff, `X-Frame-Options: DENY`, referrer policy; `SESSION_COOKIE_AGE` (12 h default); explicit stdout `LOGGING` with `LOG_LEVEL`; settings regression tests. |
| 2 — Deployment guide | `6776af5` | [ORACLE_FREE_VM_DEPLOYMENT.md](ORACLE_FREE_VM_DEPLOYMENT.md) + production Compose template (internal-only db/backend, only Caddy public), `Caddyfile.example`, `check-production-env.sh`. |
| 3 — Backup/data protection | `acebfea` | Malformed `BACKUP_ENCRYPTION_KEY` can no longer silently downgrade to plaintext; restore verifies checksum and full archive readability **before** any pre-restore/delete step; scope denial fixed; backup test suite extended. |
| 3.5 — Type-checking foundation | `36a844c` | django-stubs/DRF-stubs plugin configured; typing surface reduced from 480 to 52 errors. |
| 3.6 — Typing cleanup | `304b5da` | `mypy apps` cleared to **0 errors** (kept at 0 since). |
| 4 — RBAC/scope | `026bc6d` | Cross-tenant `assigned_to` assignment in review records closed (choices now scoped to `users_visible_to`); regression tests; verified-safe scope status documented. |
| 5 — Frontend resilience | `ef9f236` | Global session-expiry handling (401, and 403 confirmed against the auth endpoint) routes to login; React Query cache purged on login/logout/expiry so no stale data crosses sessions; app-level error boundary with no internals exposed; no retries on 4xx; fabricated-looking zero metrics removed from failed analytics/backup views; route-protection and session tests. |
| 6 — Docker/dependency hardening | `5a9a3da` | `.dockerignore` for both images; backend runs **gunicorn as a non-root user** (production server is the image default); frontend SPA built (`npm ci && npm run build`) into the Caddy image — no dev server in production; backend healthcheck on `/api/health/`; backups persisted in the `backend_media` volume; only Caddy publishes ports. |
| 7 — Operations | `5e61957` | [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) (logs, health, safe restarts, backups, updates, disk, data-loss warnings); stale key-generation/backup-copy commands fixed; health-endpoint contract tests. |
| 8 — Final report | this commit | This report, plus stale-documentation cleanup: endpoint-count contradiction fixed, container/test commands corrected for the production images, manifest brought up to date, delivered production profile no longer listed as future work. |

## 3. Security posture

- **Authentication/CSRF** — session-cookie authentication with Django CSRF
  protection; the SPA sends `X-CSRFToken` and must be served same-origin with
  the API (enforced by the deployment design and documented).
- **RBAC** — role capabilities (Admin, Superintendent, Pharmacist, Dispenser,
  Stock employee) enforced server-side via a single capability map; mutations
  re-check permissions in serializer validation; the frontend permission checks
  are UX-only.
- **Tenant scoping** — every list endpoint filters through scope-aware
  selectors (`.scoped.for_user(...)`, `patients_for`, `users_visible_to`);
  cross-tenant target references are validated on write (Phase 4 closed the one
  confirmed gap).
- **Patient-data boundaries** — patient-identifying fields are encrypted at
  rest (Fernet) with a blind (HMAC) index for last-name search. This is
  application-level at-rest encryption: **the server holds the keys and can
  decrypt** — it is not end-to-end database encryption. Aggregate/overview
  pages (dashboard, analytics, reports, alerts) were audited to render no
  patient-identifying data.
- **Audit logging** — sensitive actions are recorded in the audit app and
  exposed only to roles with audit permission.
- **Backups** — archives are AES-256-GCM encrypted; production requires
  encryption; a malformed key refuses to run rather than downgrading; secrets
  and user password hashes are excluded from archives; archives are never
  URL-served.
- **Safe restore** — admin-only, typed confirmation, checksum + full archive
  readability verified before anything is deleted, and a pre-restore safety
  backup is taken first.
- **Fail-fast production settings** — production refuses to boot with missing
  or dev-default `DJANGO_SECRET_KEY`, `PATIENT_FIELD_KEY`, `PATIENT_INDEX_KEY`,
  or `DATABASE_URL`; server entrypoints default to production settings.
- **Internal-only database** — the production Compose file publishes no ports
  for PostgreSQL or the backend; only the reverse proxy is reachable.

## 4. Deployment posture

Single free VM (Oracle Always Free class), Docker Compose:

- **Caddy** terminates HTTPS (automatic certificates), serves the built
  frontend SPA from its image, and reverse-proxies `/api` to the backend on the
  internal network — the **only** service publishing ports (80/443).
- **Backend** runs gunicorn as a non-root user, applies migrations on start,
  and has a container healthcheck on `/api/health/` (static `{"status":"ok"}`
  body; no internals leaked; contract-tested).
- **PostgreSQL 17** is internal-only, with data in a named volume; encrypted
  backup archives persist in the `backend_media` volume.
- **Environment** — secrets come only from an untracked `.env` using
  env-required Compose syntax; `check-production-env.sh` verifies values before
  deployment; same-origin requirement for session/CSRF cookies is documented.
- **Operations** — day-to-day commands, data-loss warnings, and a
  post-deployment verification checklist live in
  [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md).

## 5. Verification (final state of the branch)

| Check | Result |
| --- | --- |
| Backend test suite (pytest, host venv) | **779 passed** |
| Frontend test suite (vitest) | **436 passed** (54 files) |
| `mypy .` (django-stubs + DRF plugin, as in CI) | 0 errors (244 source files) |
| `ruff check` / `ruff format --check` | clean |
| `docker compose config` (dev + prod) | valid; prod publishes ports only on Caddy |
| Health endpoint | static `{"status":"ok"}`, no cookies set, contract-tested; live-verified through gunicorn with production settings |
| Backup hardening | covered by the backups test suite (encryption required, no plaintext downgrade, safe restore ordering, scope denials) |
| RBAC/scope | covered by tenancy/accounts/review tests incl. Phase 4 regressions |
| Frontend session/error handling | covered by session-expiry, cache-purge, error-boundary, route-protection, and retry-policy tests |

## 6. Remaining limitations

- **Synthetic/demo data only** — the system must not hold real patient data.
- No external uptime monitoring or alerting; log review is manual.
- Off-VM backup copies are a manual (documented) step, not automated.
- No SLA or high availability — a single VM; Oracle Always Free capacity is
  best-effort and can be reclaimed.
- No DPIA, hosting/data-processing agreement, clinical governance review, or
  legal/compliance sign-off has been performed.
- No penetration test by an independent party.
- Field encryption is server-side at rest; the server can decrypt (no
  end-to-end encryption claim).
- Known deferred frontend items (recorded in Phase 5): several modal picker
  dropdowns show only a generic validation message when their lookup query
  fails; alert-dismiss and one GP-form path fail partially silently; a 403 on
  the reviews screen reuses the generic error copy; backup run error text is
  shown verbatim to admins.
- Docker base images are pinned to major/minor tags, not digests; the frontend
  **development** container runs as root (development only).

## 7. Final statement

With the hardening applied in Phases 1–7, this system is suitable for a
**secure synthetic-data public demo** on a small internet-facing VM.

It is **not suitable for real-patient production use**. Before any use with
real patient data it would require, at minimum: professional security review,
a DPIA, a hosting/data-processing agreement, clinical governance review,
independent penetration testing, monitoring and alerting, an incident-response
process, and legal/compliance sign-off. No production certification, NHS/NCRS
integration, or clinical capability is claimed.
