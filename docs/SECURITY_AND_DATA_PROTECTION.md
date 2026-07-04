# Security and Data Protection

How AI Pharmacy Manager protects access and data, described honestly. This is an
academic prototype operating on **fictional/synthetic data**; it makes no
regulatory or compliance claim and must never hold real patient data.

## Summary

The system is designed for **encrypted transport (TLS in production),
session-based authentication, role-based access control, tenant scoping, audit
logging, application-level field encryption at rest for patient identifiers, and
encrypted backups, on a PostgreSQL deployment.** Full end-to-end encryption of
the database is **not** claimed — the server holds the keys and decrypts patient
fields to search, report, and back up. Database-wide field encryption for all
sensitive columns is identified as future work.

## Authentication

- **Session-based auth** using Django's server-side sessions. The custom user
  model (`accounts.User`) uses email as the username. DRF is configured with
  `SessionAuthentication` only (no token/JWT).
- **Login** validates email + password via Django's authenticator and starts a
  session. Invalid credentials return a generic error. Login is **rate-limited**
  (`LOGIN_THROTTLE_RATE`, default `10/min`).
- **Passwords** are hashed by Django's default hasher stack and validated against
  Django's validators (similarity, minimum length, common-password, numeric) on
  creation, change, and reset. New accounts are flagged `must_change_password`.
- **Password change** verifies the current password, revalidates the new one,
  records a `PASSWORD_CHANGED` audit event, and keeps the session valid.

## Sessions and CSRF

- Session cookie: `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- CSRF protection is enabled (Django `CsrfViewMiddleware`). State-changing
  requests require the CSRF token; the SPA reads it from a non-`HttpOnly` CSRF
  cookie seeded by `GET /api/auth/csrf/`. `CSRF_TRUSTED_ORIGINS` and CORS origins
  are configured per environment; CORS runs with credentials enabled.

## Role-based access control (RBAC)

Roles are defined in `tenancy` and a user has at most one active membership
(enforced by a database constraint). Capabilities are checked by
`can(user, action, target)` and by DRF `require(...)` permissions.

| Role | Scope | Capabilities (high level) |
| --- | --- | --- |
| `ADMIN` | **Global** super-admin | Everything, in every group/pharmacy. |
| `SUPERINTENDENT` | One **group** (all its pharmacies) | Stock, forecasts, transfer suggestions, medications, audit view. No patient/dosette/review or user management. |
| `PHARMACIST` | One **pharmacy** | Full stock, forecasts, patients, dosette, reviews, user management, audit view, medications. |
| `DISPENSER` | One **pharmacy** (read-mostly) | View patients/stock, receive stock, dosette view + status changes, review view. |
| `STOCK_EMPLOYEE` | A **group + a chosen set of pharmacies** | Stock (view/manage/receive/transfer), forecasts, medication view. |

Access is enforced two ways: the caller must have the capability for the action,
**and** the target record must be inside the caller's group/pharmacy scope
(`_target_in_scope`). Global (`ADMIN`) always passes the scope check.

## Tenant scoping

The data model is `Group → Pharmacy → (patients, stock, etc.)`. Each request
resolves the user's active membership into an access scope
(`is_global`, `group_ids`, `pharmacy_ids`), and querysets across patients, stock,
audit, backups, and analytics are filtered to that scope. User provisioning is
also bounded: a pharmacist can only create/assign pharmacist or dispenser users
within their own pharmacy.

## Audit logging

- An append-only `AuditEvent` log records actions with the actor, a snapshot of
  the actor's email and role, the target, tenant scope, IP address, user agent,
  and a timestamp.
- Login, logout, and failed-login events are captured automatically via Django
  auth signals (failures record the attempted email, no actor). Domain events
  (password change, role assignment, patient/stock/dosette/review changes, etc.)
  are recorded explicitly.
- **Immutability is enforced at the application layer:** the model blocks updates
  and deletes. This does **not** block raw SQL or bulk `QuerySet` operations —
  true database-level immutability (triggers/permissions) is identified as future
  hardening.
- **Read access is scoped:** global roles see all events; a pharmacist sees only
  their pharmacy's events; other group-scoped roles currently see none, pending a
  patient-safe allowlist (a deliberate, documented restriction).

## PostgreSQL runtime database

The runtime and deployment database is **PostgreSQL**. See
[DEPLOYMENT.md](DEPLOYMENT.md). SQLite is not an application database; it can only
appear as an optional temporary file for isolated local test runs.

## Patient field encryption (at rest, not end-to-end)

- Selected patient identifiers are stored with **application-level field
  encryption** using **Fernet** (AES-128-CBC + HMAC-SHA256). Encrypted fields on
  `Patient`: title, first name, last name, date of birth, gender, address,
  postcode, phone, email, notes; plus `PatientNote.body`, `PatientMedication`
  dose instructions, and `ReviewRecord` notes.
- **This is encryption at rest, not end-to-end encryption.** The server holds the
  key and decrypts values on read to display, search, generate reports, and create
  backups. Anyone with the key and database access can read plaintext. It protects
  against exposure of the database files/dumps, not against the running server.
- **Searchable without decrypting everything:** a **blind index** (`last_name_index`)
  stores an HMAC digest of the last name (not plaintext), enabling equality search.
- GP/practice contact details are stored in plain columns by design (practice
  contact info, not the patient's own identity data).
- Keys (`PATIENT_FIELD_KEY`, `PATIENT_INDEX_KEY`) come from the environment. Dev
  defaults are explicitly labelled "not a secret"; production refuses to start if
  they are unset, blank, or left at the dev default.

## Backup encryption

- Group backup archives are encrypted at rest with **AES-256-GCM** (authenticated
  encryption), keyed by `BACKUP_ENCRYPTION_KEY`. The key is never written into the
  archive, manifest, or logs.
- Because the archive contains **decrypted** patient/stock records (encrypted
  fields are decrypted before serialisation), encrypting the whole archive is what
  protects it at rest.
- Backups exclude user accounts, password hashes, secrets, sessions, and cache;
  user foreign keys are nulled on export. Restore is admin-only, requires typing
  `RESTORE`, validates the manifest/key before any deletion, and takes a
  pre-restore safety backup. Full details in
  [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md).

## Transport security (production)

Production settings (`config.settings.prod`) enforce:

- `DEBUG=False`, and fail-fast startup if secret/encryption keys are unset.
- HSTS for one year (`includeSubDomains`, `preload`), `SECURE_SSL_REDIRECT`, and
  `SECURE_PROXY_SSL_HEADER` for TLS termination behind a reverse proxy.
- `SECURE_CONTENT_TYPE_NOSNIFF`, clickjacking protection (`X-Frame-Options`), and
  `Secure` session/CSRF cookies.
- Encrypted backups required by default.

Development settings do not enable these, so **serve production only over HTTPS**.

## Data minimisation

- Only the encrypted patient identity fields and encrypted note bodies hold PII.
  Analytics, reports, and the work queue expose counts, quantities, and IDs — not
  patient identities.
- The app ships with **fictional demo data** via `seed_demo`; `reset_demo_data`
  is dev-gated and only affects the `@demo.local` workspace. The demo accounts
  share a documented demo-only password and must be rotated or disabled before
  any public deployment (see the [deployment checklist](DEPLOYMENT.md)).
- Audit metadata stores staff email, IP, and user agent (plaintext); audit reads
  are tenant-scoped.

## Known future enhancements

- Database-level audit immutability (triggers/permissions).
- Superintendent audit visibility via a patient-safe action allowlist.
- Production-grade key management and rotation for field and backup keys.
- Broader field-level encryption / masking for additional sensitive columns.

(The production deployment profile — gunicorn as non-root, built static
frontend served by Caddy, internal-only database — was delivered by the
hardening series; see `docker-compose.prod.yml` and the
[industry hardening report](INDUSTRY_HARDENING_REPORT.md).)
