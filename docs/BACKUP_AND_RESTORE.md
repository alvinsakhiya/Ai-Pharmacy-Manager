# Backup and Restore

This document explains, in plain terms, how AI Pharmacy Manager backs up and
restores operational data, what protection is in place, and what is recommended
before running on the internet.

> **Scope note.** This is an *application-level, group-scoped* backup of
> operational records. It is not a full PostgreSQL server backup. For disaster
> recovery you should also run database-level backups (see
> [Production recommendations](#production-recommendations)).

## What is backed up

A backup captures the operational records that belong to a single **group**
(a pharmacy organisation and its branches):

- Group and its pharmacies
- Medications, and the catalogue products those medications reference
- Patients, patient GP details, patient notes, patient medications
- Dosette/MDS periods and cycles
- Stock items, stock batches, stock movements
- Pharmacist review records
- Stock-intelligence outputs (forecast runs, forecast items, transfer signals)
- Audit events for the group and its pharmacies

The archive stores a `data.json` payload plus a `manifest.json` describing it.

Because patient identifier fields are stored using application-level field
encryption and are **decrypted when read**, the `data.json` payload contains
readable patient and stock data. That is exactly why the archive itself is
encrypted at rest (see below).

## What is excluded

The following are never written into a backup:

- User accounts and **password hashes** (the `User` model is not serialised)
- Environment variables, `DJANGO_SECRET_KEY`, `PATIENT_FIELD_KEY`,
  `PATIENT_INDEX_KEY`, `TRUD_API_KEY`, and other secrets
- Sessions and cache files
- Uploaded design assets and other media

User foreign keys on operational records (for example "prepared by",
"checked by", "actor", "author") are **nulled** in the backup so restoring into a
different environment cannot resurrect or leak user identities. A safety guard
(`_assert_no_secret_markers`) aborts a backup if any known secret marker is
detected in the payload.

## Where backups are stored

Backups are written to `BACKUP_ROOT`, which defaults to
`backend/media/backups/`. Each group gets its own sub-folder:

```
media/backups/<group-slug>/group-<group-id>-<timestamp>-<run-id>.zip.enc
```

The `.zip.enc` extension indicates an encrypted archive; `.zip` indicates an
unencrypted development archive (see below). `media/` is git-ignored and is not
served publicly.

## Encryption at rest

Encrypted backups use **AES-256-GCM** (authenticated encryption). The archive is
built in memory as a zip, then the whole zip is encrypted before it touches
disk. A random 12-byte nonce is generated per archive and a short magic header
(`AIPMB1`) lets the reader detect an encrypted file without needing the key.

- **Key source:** the `BACKUP_ENCRYPTION_KEY` environment variable — a base64
  32-byte key. It is never written into the archive, the manifest, or the logs,
  and must never be committed.
- **Generate a key:**
  ```bash
  docker compose exec backend python manage.py generate_backup_key
  ```
- **Require encryption:** set `BACKUP_ENCRYPTION_REQUIRED=True`. Backup creation
  is then refused (with a clear message) if no key is configured. This is the
  default in the production settings.
- **Development default:** if no key is set and encryption is not required,
  backups are written as an unencrypted `.zip` for convenience. Do not use
  unencrypted backups with anything other than fictional demo data.

Because GCM is authenticated, a wrong key or a tampered/corrupt file fails to
decrypt rather than returning bad data.

A **present-but-invalid** `BACKUP_ENCRYPTION_KEY` (wrong length or not base64) is
rejected: backup creation fails with a clear error rather than silently
downgrading to an unencrypted archive. A **blank** key is treated as "no key"
(unencrypted dev backups, subject to `BACKUP_ENCRYPTION_REQUIRED`).

## Manifest metadata

Every archive contains a `manifest.json` with:

| Field | Meaning |
| --- | --- |
| `format_version` | Backup archive format version |
| `app_version` | Application version at backup time (`APP_VERSION`) |
| `created_at` | Timestamp the archive was written |
| `run_id`, `trigger` | Backup run id and how it was triggered |
| `group` | Group id, slug, and name the backup belongs to |
| `encryption` | `{ enabled, algorithm }` (algorithm is `AES-256-GCM` when enabled) |
| `content_checksum` | `sha256` of the `data.json` payload (content integrity) |
| `included_models` | The model labels captured in the archive |
| `excludes` | Human-readable list of what is deliberately left out |

Separately, the `BackupRun` record stores a `checksum` (sha256 of the file on
disk) and an `encrypted` flag, both surfaced through the backup API.

## How restore works

Restore is deliberately conservative:

1. **Admin only.** Only the `ADMIN` role can restore.
2. **Explicit confirmation.** The caller must send `confirm = "RESTORE"`; any
   other value is rejected.
3. **Integrity and key validation first.** Before anything is changed, the
   archive's on-disk **checksum is verified** against the recorded value, then
   the manifest and data payload are read in full (decrypting the archive). A
   checksum mismatch, a wrong/missing key, a group mismatch, or an unreadable
   payload aborts the restore with a `400` **before** any deletion or pre-restore
   backup — nothing is lost. This protects unencrypted archives too, where the
   GCM authentication tag does not apply.
4. **Pre-restore safety backup.** A `PRE_RESTORE` backup of the current state is
   taken so a restore can itself be undone.
5. **Group-scoped, atomic replace.** Inside a database transaction, the group's
   operational records are deleted and re-created from the archive.
6. **Global catalogue is protected.** `catalogue.catalogueproduct` rows are
   included in the archive (to preserve medication links) but are **skipped on
   restore**, so restoring one group never overwrites the shared reference
   catalogue used by other groups.

The UI wording should make the impact clear, e.g.:

> Restoring replaces the operational records for this group. A safety backup is
> created first, so this can be undone.

## Retention

Each group keeps its most recent successful/restored backups (default: 3).
Older archives are deleted automatically. The retention count lives on the
group's backup schedule.

## Scheduled backups

A backup schedule per group (`enabled`, `daily_time`, `retention_count`) drives
optional daily backups. They run when the scheduler command is invoked:

```bash
docker compose exec backend python manage.py run_scheduled_backups
```

In production this command is expected to be triggered by an external scheduler
(cron, a container scheduler, or a managed job).

## Production recommendations

Implemented in this project:

- Encrypted archives at rest (AES-256-GCM), key from the environment
- Authenticated encryption (integrity + confidentiality)
- Group scoping and global-catalogue protection on restore
- Admin-only, confirmed restore with a pre-restore safety backup
- Secret/PII-key exclusion and user-hash exclusion
- Retention

Recommended before internet deployment (not all implemented here):

- **Off-site / object storage.** Copy archives to private object storage
  (e.g. an access-controlled bucket or protected volume), never a public web
  directory. Keep a scheduled off-site copy.
- **Database-level backups.** Add regular `pg_dump`/managed PostgreSQL snapshots
  for full disaster recovery (schema, roles, all groups).
- **Key management.** Store `BACKUP_ENCRYPTION_KEY` in a secrets manager, back it
  up separately from the archives, and define a rotation procedure. Losing the
  key means encrypted archives cannot be restored.
- **Transport security.** Serve the application over TLS/HTTPS.
- **Monitoring.** Alert on failed or missing scheduled backups.

## Configuration reference

| Variable | Purpose | Default |
| --- | --- | --- |
| `BACKUP_ENCRYPTION_KEY` | Base64 32-byte AES-256-GCM key | empty (dev unencrypted) |
| `BACKUP_ENCRYPTION_REQUIRED` | Refuse backups without a key | `False` (base), `True` (prod) |
| `BACKUP_ROOT` | Archive storage directory | `backend/media/backups/` |
| `APP_VERSION` | Version recorded in the manifest | `1.0.0` |
