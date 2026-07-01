# Database Schema

The runtime and deployment database is **PostgreSQL 17**. The schema is defined by Django models per app and created through Django migrations (`python manage.py migrate`). SQLite is **not** used as an application database anywhere; see [DEPLOYMENT.md](DEPLOYMENT.md) for the one place it can appear as optional throwaway test infrastructure.

Key conventions:

- **Multi-tenant scoping:** most tables hang off `tenancy.Group` → `tenancy.Pharmacy`. Rows are filtered to the caller's scope.
- **Sensitive / encrypted:** patient identifiers and free-text notes are stored with application-level field encryption (Fernet) at rest, with a blind index for last-name search. This is encryption at rest, **not** end-to-end encryption — the server decrypts values to search, report, and back up. See [SECURITY_AND_DATA_PROTECTION.md](SECURITY_AND_DATA_PROTECTION.md).
- **Backup relevance:** what the group backup includes/excludes. User rows and password hashes are never exported; user foreign keys are nulled on export. See [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md).

## `core`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **TimeStampedModel** | Abstract base adding created_at/updated_at timestamps to concrete models. | created_at (auto_now_add), updated_at (auto_now) | None (abstract=True) | none | Abstract; not backed up directly. Its timestamp fields ride along on every concrete model that inherits it. |
| **SoftDeleteModel** | Abstract base providing soft-delete flags and soft_delete() helper. | is_active (bool, default True), deleted_at (datetime, nullable) | None (abstract=True) | none | Abstract; not backed up directly. Fields inherited by Patient and PatientMedication, which are backed up. |

## `tenancy`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **Group** | Top-level tenant (pharmacy group/organization); root of the multi-tenant scoping and the unit of backup. | name, slug (unique), is_active; tenant_group_id_field='id' | Reverse FKs from Pharmacy, Membership, Medication, BackupSchedule (O2O), BackupRun, AuditEvent, analytics.ForecastRun, analytics.TransferSuggestion | none | INCLUDED: serialized as Group.objects.filter(pk=group.pk). The group is the backup scope; archive manifest embeds its id/slug/name. |
| **Pharmacy** | A single pharmacy branch within a Group; the pharmacy-level tenant scope. | name, code, address, postcode, is_active; unique (group, code); tenant_pharmacy_id_field='id' | FK group->tenancy.Group (PROTECT); reverse FKs from Patient, StockItem, Membership, AuditEvent, forecast/transfer models | none (pharmacy address/postcode are business, not patient PII) | INCLUDED: Pharmacy.objects.filter(group=group). pharmacy_ids drive scoping of nearly all other backed-up querysets. |
| **Membership** | Assigns a user a role scoped to a group or pharmacy; enforces role/scope consistency via check constraint and clean(). | role (Role choices: ADMIN/SUPERINTENDENT/STOCK_EMPLOYEE/PHARMACIST/DISPENSER), is_active; check constraint membership_scope_matches_role; unique active membership per user | FK user->AUTH_USER_MODEL (CASCADE); FK group->Group (PROTECT, nullable); FK pharmacy->Pharmacy (PROTECT, nullable); M2M pharmacies->Pharmacy (stock_memberships) | none | EXCLUDED: not in _serialized_group_objects. Membership/user data is deliberately not part of group backups (users restored as null refs elsewhere). |

## `accounts`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **User** | Custom email-based auth user (AbstractBaseUser + PermissionsMixin). | email (unique, USERNAME_FIELD), full_name, is_active, is_staff, must_change_password, date_joined; REQUIRED_FIELDS=['full_name'] | Referenced by settings.AUTH_USER_MODEL across many models (Membership, AuditEvent.actor, PatientNote.author, blister prepared_by/checked_by/submitted_by/collected_by, StockMovement.actor, review assigned_to, backup created_by/updated_by, forecast generated_by, NotificationDismissal, transfer generated_by) | PII: email and full_name are personal data; password hash stored via AbstractBaseUser (not application-encrypted; no EncryptedField/blind-index). Plain columns. | EXCLUDED: User rows are never serialized. All FK references to users are nulled on export (USER_REFERENCE_FIELDS in _json_objects), and password hashes are explicitly listed as manifest excludes. |

## `patients`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **Patient** | Core patient demographic record (fictional/prototype), scoped to a pharmacy, with soft-delete. | patient_reference, collection_method (IN_STORE/DELIVERY), last_name_index (plain blind-index, db_index), + encrypted PII fields; inherits is_active/deleted_at; unique (pharmacy, patient_reference) | FK pharmacy->tenancy.Pharmacy (PROTECT); reverse: PatientNote, PatientGp (O2O), PatientMedication, DosettePeriod, DosetteCycle, ReviewRecord; tenant_pharmacy_id_field='pharmacy' | HEAVY PII: EncryptedTextField for title, first_name, last_name, gender, address, postcode, phone, email, notes; EncryptedDateField for date_of_birth. last_name_index is a plaintext BLIND-INDEX (CharField) of last_name for searchable lookup, set in save() via blind_index(). | INCLUDED: Patient.objects.filter(pharmacy_id__in=pharmacy_ids). Encrypted ciphertext is serialized as-is (values stay encrypted in the archive since serialization reads DB-prepped values through the field). |
| **PatientNote** | Append-only, immutable patient note with encrypted body (save/delete guarded). | body (encrypted), author_email; append-only (save blocks update, delete raises) | FK patient->Patient (PROTECT); FK author->AUTH_USER_MODEL (SET_NULL); tenant_pharmacy_id_field='patient__pharmacy' | PII: body is EncryptedTextField (clinical/personal note text). author_email is plaintext CharField (staff email, minor PII). | INCLUDED: PatientNote.objects.filter(patient_id__in=patient_ids). author FK nulled on export (USER_REFERENCE_FIELDS patients.patientnote->author); encrypted body serialized as ciphertext. |
| **PatientGp** | GP/doctor surgery contact details for a patient (practice info, not the patient's own PII). | doctor_name, practice_name, practice_address, practice_postcode, practice_phone, practice_email (all plain CharFields) | O2O patient->Patient (CASCADE); tenant_pharmacy_id_field='patient__pharmacy' | none (plain columns; treated as practice contact info, not patient PII per model docstring) | INCLUDED: PatientGp.objects.filter(patient_id__in=patient_ids). |

## `catalogue`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **CatalogueProduct** | Reference drug catalogue entry (dm+d/TRUD/seed/manual) used to back Medication; builds a search_text index on save. | dmd_code, source, dmd_type (VMP/AMP/VMPP/AMPP), display_name, ingredient, strength, dose_form, pack_size/unit, manufacturer, appearance_*, search_text, is_active, is_discontinued; unique dmd_code when non-empty | Reverse FKs from catalogue.Medication, analytics.ForecastItem, analytics.TransferSuggestion. No tenant scope (global reference data). | none (public reference data) | INCLUDED but restore-skipped: only products referenced by the group's Medications are serialized (CatalogueProduct.objects.filter(pk__in=catalogue_product_ids)). Listed in RESTORE_SKIP_MODELS so it is exported for completeness but NOT re-imported on restore (kept as shared global reference data). |
| **Medication** | Group-scoped medication master record, optionally linked to a CatalogueProduct. | name, form (MedicationForm choices), strength, manufacturer, notes, is_active; unique (group,name,form,strength) and unique (group,catalogue_product); tenant_group_id_field='group' | FK group->tenancy.Group (PROTECT); FK catalogue_product->CatalogueProduct (PROTECT, nullable); reverse: inventory.StockItem, blister.PatientMedication | none | INCLUDED: Medication.objects.filter(group=group). Its catalogue_product_id set is what selects which CatalogueProduct rows get exported. |

## `inventory`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **StockItem** | Per-pharmacy stock line for a medication (pricing, reorder level). | unit_price, pack_price, reorder_level, is_active; unique (pharmacy, medication); tenant_pharmacy_id_field='pharmacy' | FK pharmacy->tenancy.Pharmacy (PROTECT); FK medication->catalogue.Medication (PROTECT); reverse: StockBatch, StockMovement, analytics forecast/transfer items | none | INCLUDED: StockItem.objects.filter(pharmacy_id__in=pharmacy_ids). stock_item_ids scope StockBatch/StockMovement export. |
| **StockBatch** | A received batch of stock for a StockItem with expiry (FEFO) tracking. | batch_number, expiry_date, quantity, quantity_received, received_at, is_active; unique (stock_item, batch_number); tenant_pharmacy_id_field='stock_item__pharmacy' | FK stock_item->StockItem (PROTECT); reverse: StockMovement | none | INCLUDED: StockBatch.objects.filter(stock_item_id__in=stock_item_ids). |
| **StockMovement** | Append-only ledger of stock changes (receipts/adjustments/transfers/blister deductions) with running balance. | movement_type (MovementType choices), quantity_delta (nonzero via check), balance_after, reason, reference (db_index); append-only (save blocks update, delete raises); tenant_pharmacy_id_field='stock_item__pharmacy' | FK stock_item->StockItem (PROTECT); FK batch->StockBatch (PROTECT, nullable); FK actor->AUTH_USER_MODEL (SET_NULL) | none | INCLUDED: StockMovement.objects.filter(stock_item_id__in=stock_item_ids). actor FK nulled on export (USER_REFERENCE_FIELDS inventory.stockmovement->actor). |

## `blister`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **PatientMedication** | A patient's active medication line for dosette/MDS packing, with per-slot dose quantities and label appearance. | dose_instructions (encrypted), quantity_morning/lunchtime/evening/bedtime, start_date, colour, shape; inherits is_active/deleted_at; unique active medication per patient; tenant_pharmacy_id_field='patient__pharmacy' | FK patient->patients.Patient (PROTECT); FK medication->catalogue.Medication (PROTECT) | PII: dose_instructions is an EncryptedTextField (clinical dosing text). colour/shape are plain descriptive label fields (not sensitive). | INCLUDED: PatientMedication.objects.filter(patient_id__in=patient_ids). Encrypted dose_instructions serialized as ciphertext. |
| **DosettePeriod** | A submitted dosette request/period for a patient (28-day cycle scheduling with due/reminder date properties). | start_date, end_date, status (SUBMITTED/COLLECTED/CANCELLED), submitted_at, collected_on; check end>=start; unique SUBMITTED period per patient; tenant_pharmacy_id_field='patient__pharmacy' | FK patient->patients.Patient (PROTECT); FK submitted_by->AUTH_USER_MODEL (SET_NULL); FK collected_by->AUTH_USER_MODEL (SET_NULL); reverse: DosetteCycle | none | INCLUDED: DosettePeriod.objects.filter(patient_id__in=patient_ids). submitted_by and collected_by FKs nulled on export (USER_REFERENCE_FIELDS blister.dosetteperiod). |
| **DosetteCycle** | An individual dosette/blister pack cycle with prep/check accountability and stock-deduction tracking. | week_number (1-4 check), reference, frequency (CycleFrequency), start/end_date, status (CycleStatus incl DRAFT/PREPARED/CHECKED/etc), stock_deducted, deducted_at, prepared_at, checked_at; unique (patient,reference); unique (period,week_number); tenant_pharmacy_id_field='patient__pharmacy' | FK patient->patients.Patient (PROTECT); FK period->DosettePeriod (PROTECT, nullable); FK prepared_by->AUTH_USER_MODEL (SET_NULL); FK checked_by->AUTH_USER_MODEL (SET_NULL); reverse: reviews.ReviewRecord | none | INCLUDED: DosetteCycle.objects.filter(patient_id__in=patient_ids). prepared_by and checked_by FKs nulled on export (USER_REFERENCE_FIELDS blister.dosettecycle). |

## `reviews`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **ReviewRecord** | Operational pharmacist review workflow record for a patient (non-clinical, no recommendations). | status (ReviewStatus), priority (ReviewPriority), due_date, completed_at, notes (encrypted); ordered by due_date nulls_last; tenant_pharmacy_id_field='patient__pharmacy' | FK patient->patients.Patient (PROTECT); FK dosette_cycle->blister.DosetteCycle (PROTECT, nullable); FK assigned_to->AUTH_USER_MODEL (SET_NULL) | PII: notes is an EncryptedTextField (review notes about a patient). | INCLUDED: ReviewRecord.objects.filter(patient_id__in=patient_ids). assigned_to FK nulled on export (USER_REFERENCE_FIELDS reviews.reviewrecord); encrypted notes serialized as ciphertext. |

## `analytics`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **ForecastRun** | A demand-forecast run for a pharmacy (baseline model), grouping ForecastItems. | horizon_days, lookback_days, model_version, is_demo, status (COMPLETED/FAILED); tenant_pharmacy_id_field='pharmacy' | FK pharmacy->tenancy.Pharmacy (PROTECT); FK group->tenancy.Group (PROTECT); FK generated_by->AUTH_USER_MODEL (SET_NULL); reverse: ForecastItem | none | INCLUDED: apps.get_model('analytics','ForecastRun').objects.filter(group=group). generated_by FK nulled on export (USER_REFERENCE_FIELDS analytics.forecastrun). forecast_run_ids scope ForecastItem export. |
| **ForecastItem** | Per-medication forecast line within a ForecastRun (predicted usage, current stock, suggested reorder, confidence, explanation). | medication_label, predicted_usage_units/packs, current_stock_units/packs, safety_stock_units, suggested_reorder_units/packs, confidence, explanation, history_points_count, window_days | FK run->ForecastRun (CASCADE); FK stock_item->inventory.StockItem (PROTECT); FK catalogue_product->catalogue.CatalogueProduct (PROTECT, nullable) | none | INCLUDED: ForecastItem.objects.filter(run_id__in=forecast_run_ids). No user FK to null. |
| **TransferSuggestion** | Group-level suggestion to transfer dead/excess stock between pharmacies. | medication_label, suggested_quantity_units/packs, current_source_stock_units, destination_recent_usage_units, dead_days, confidence, reason, status (OPEN/DISMISSED/ACTIONED), model_version; tenant_group_id_field='group' | FK group->tenancy.Group (PROTECT); FK catalogue_product->catalogue.CatalogueProduct (PROTECT, nullable); FK source_pharmacy & destination_pharmacy->tenancy.Pharmacy (PROTECT); FK source_stock_item & destination_stock_item->inventory.StockItem (PROTECT, nullable); FK generated_by->AUTH_USER_MODEL (SET_NULL) | none | INCLUDED: apps.get_model('analytics','TransferSuggestion').objects.filter(group=group). generated_by FK nulled on export (USER_REFERENCE_FIELDS analytics.transfersuggestion). |

## `audit`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **AuditEvent** | Append-only audit log of user/system actions (login, patient/stock/blister/review events) with actor and target metadata. | action (AuditAction choices), actor_email, actor_role, target_type, target_id, metadata (JSON), ip_address, user_agent, created_at (db_index); append-only (save blocks update, delete raises) | FK actor->AUTH_USER_MODEL (SET_NULL); FK group->tenancy.Group (SET_NULL, nullable); FK pharmacy->tenancy.Pharmacy (SET_NULL, nullable) | PII (plaintext, not encrypted): actor_email, ip_address, user_agent, and metadata (JSON) may contain personal/identifying data; all stored in plain columns. No EncryptedField/blind-index. | INCLUDED: AuditEvent.objects.filter(Q(group=group) \| Q(pharmacy_id__in=pharmacy_ids)). actor FK nulled on export (USER_REFERENCE_FIELDS audit.auditevent->actor); actor_email/ip/user_agent still exported in plaintext. |

## `backups`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **BackupSchedule** | Per-group configuration for automated daily backups (enable, time, retention). | enabled, daily_time (default 02:00), retention_count (default 3) | O2O group->tenancy.Group (CASCADE); FK created_by & updated_by->AUTH_USER_MODEL (SET_NULL) | none | EXCLUDED: not serialized in _serialized_group_objects. Backup configuration/metadata is not itself part of the backup archive. |
| **BackupRun** | Record of a single backup run (status, trigger, output file, checksum, encryption flag, timings). | status (BackupRunStatus), trigger (MANUAL/SCHEDULED/PRE_RESTORE), file, file_size, started_at, completed_at, error_message, checksum, encrypted | FK group->tenancy.Group (CASCADE); FK created_by->AUTH_USER_MODEL (SET_NULL) | none (file is a path/name, not patient data) | EXCLUDED: not serialized into archives (that would be self-referential). It is the model that RECORDS/produces backups; its rows drive create/restore/retention logic but are not themselves backed up. |

## `notifications`

| Model | Purpose | Key fields | Relationships | Sensitive / encrypted | Backup relevance |
| --- | --- | --- | --- | --- | --- |
| **NotificationDismissal** | Tracks that a specific user dismissed a specific alert (by fingerprint) so it is not re-shown. | alert_fingerprint (db_index), dismissed_at; unique (user, alert_fingerprint) | FK user->AUTH_USER_MODEL (CASCADE) | none | EXCLUDED: not in _serialized_group_objects. Per-user UI dismissal state, tied to users (which are excluded), so it is not part of group backups. |
