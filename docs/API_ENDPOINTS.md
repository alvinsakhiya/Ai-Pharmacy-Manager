# API Endpoints

Every endpoint is a JSON REST endpoint served by Django REST Framework under the `/api/` prefix. Unless noted otherwise:

- **Authentication:** server-side session cookie (Django sessions). The only public endpoints are the health check, the CSRF-cookie endpoint, and login.
- **CSRF:** state-changing requests (POST/PUT/PATCH/DELETE) require the CSRF token; call `GET /api/auth/csrf/` first to seed the cookie.
- **Authorisation:** endpoints are gated by role capabilities and are tenant-scoped, so a caller only ever sees or changes records inside their group/pharmacy scope. `ADMIN` is a global super-admin. See [SECURITY_AND_DATA_PROTECTION.md](SECURITY_AND_DATA_PROTECTION.md).
- **Kind:** *read* = safe/idempotent retrieval; *mutation* = creates or changes data (and is audit-logged where relevant).

There are **107 endpoints** in total. The intelligence, reports, and notification endpoints are read-only signals — nothing is ordered, transferred, or dispensed automatically; human review is always required.

## Authentication (`/api/auth/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/health/` | Health check; returns {status: ok}. Also served at /. | AllowAny (public) | read |
| GET | `/api/auth/csrf/` | Set the CSRF cookie for subsequent authenticated requests. | AllowAny (public) | read |
| POST | `/api/auth/login/` | Authenticate email+password, start session, return the 'me' payload. | AllowAny (public); login-scoped rate throttle | mutation |
| POST | `/api/auth/logout/` | Log out and destroy the session. | authenticated | mutation |
| GET | `/api/auth/me/` | Return current user: identity, active role, scope, pharmacies, and permission map. | authenticated | read |
| POST | `/api/auth/password/change/` | Change own password after verifying the current one; clears must_change_password. | authenticated | mutation |

## Users (`/api/users/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/users/` | List users visible to the caller within their scope. | USER_MANAGE (admin, pharmacist) | read |
| POST | `/api/users/` | Create a new user with a role and pharmacy membership. | USER_CREATE (admin, pharmacist) | mutation |
| GET | `/api/users/<pk>/` | Retrieve a single user in scope. | USER_MANAGE (admin, pharmacist) | read |
| PATCH | `/api/users/<pk>/` | Partially update a user's profile fields. | USER_MANAGE (admin, pharmacist) | mutation |
| DELETE | `/api/users/<pk>/` | Hard-delete a user (cannot delete self). | USER_DELETE (admin only) | mutation |
| POST | `/api/users/<pk>/deactivate/` | Deactivate a user (set is_active=False; cannot deactivate self). | USER_DEACTIVATE (admin, pharmacist) | mutation |
| POST | `/api/users/<pk>/reset-password/` | Admin-set a new password for a user and force change on next login. | USER_RESET_PASSWORD (admin, pharmacist) | mutation |
| POST | `/api/users/<pk>/assign-membership/` | Reassign a user's role/group/pharmacy membership (cannot reassign self). | USER_ASSIGN_ROLE (admin, pharmacist) | mutation |

## Patients (`/api/patients/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/patients/` | List patients in scope; supports pharmacy filter and reference/name blind-index search. | PATIENT_VIEW (admin, pharmacist, dispenser) | read |
| POST | `/api/patients/` | Create a patient record. | PATIENT_MANAGE (admin, pharmacist) | mutation |
| GET | `/api/patients/<pk>/` | Retrieve a single patient in scope. | PATIENT_VIEW (admin, pharmacist, dispenser) | read |
| PUT/PATCH | `/api/patients/<pk>/` | Update a patient record (audited with changed fields). | PATIENT_MANAGE (admin, pharmacist) | mutation |
| POST | `/api/patients/<pk>/deactivate/` | Soft-delete/deactivate a patient. | PATIENT_MANAGE (admin, pharmacist) | mutation |
| GET | `/api/patients/<pk>/gp/` | Get the patient's GP/doctor details (empty defaults if none). | PATIENT_VIEW (admin, pharmacist, dispenser) | read |
| PUT/PATCH | `/api/patients/<pk>/gp/` | Create/update the patient's GP/doctor details. | PATIENT_MANAGE (admin, pharmacist) | mutation |
| GET | `/api/patients/<pk>/notes/` | List a patient's history notes. | PATIENT_VIEW (admin, pharmacist, dispenser) | read |
| POST | `/api/patients/<pk>/notes/` | Add a history note to a patient (author recorded). | PATIENT_MANAGE (admin, pharmacist) | mutation |

## Dosette / MDS (`/api/patients/<pk>/…`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/patients/<patient_pk>/medications/` | List a patient's blister/dosette medication lines; optional is_active filter. | BLISTER_VIEW (admin, pharmacist, dispenser) | read |
| POST | `/api/patients/<patient_pk>/medications/` | Add a medication line to a patient's dosette regimen. | BLISTER_MANAGE (admin, pharmacist) | mutation |
| GET | `/api/patients/<patient_pk>/medications/<pk>/` | Retrieve a single dosette medication line. | BLISTER_VIEW (admin, pharmacist, dispenser) | read |
| PUT/PATCH | `/api/patients/<patient_pk>/medications/<pk>/` | Update a dosette medication line (audited). | BLISTER_MANAGE (admin, pharmacist) | mutation |
| PATCH | `/api/patients/<patient_pk>/medications/<pk>/appearance/` | Edit label colour/shape for the printed pack; dispenser-editable. | require(BLISTER_VIEW) as gate, then in-view BLISTER_MARK_STATUS check (admin, pharmacist, dispenser) | mutation |
| POST | `/api/patients/<patient_pk>/medications/<pk>/discontinue/` | Soft-delete/discontinue an active medication line. | BLISTER_MANAGE (admin, pharmacist) | mutation |
| GET | `/api/patients/<patient_pk>/cycles/` | List a patient's dosette cycles; optional status filter. | BLISTER_VIEW (admin, pharmacist, dispenser) | read |
| POST | `/api/patients/<patient_pk>/cycles/` | Create a dosette cycle for a patient (audited). | BLISTER_MANAGE (admin, pharmacist) | mutation |
| GET | `/api/patients/<patient_pk>/cycles/<pk>/` | Retrieve a single dosette cycle. | BLISTER_VIEW (admin, pharmacist, dispenser) | read |
| PUT/PATCH | `/api/patients/<patient_pk>/cycles/<pk>/` | Update a dosette cycle (audited with changed fields). | BLISTER_MANAGE (admin, pharmacist) | mutation |
| POST | `/api/patients/<patient_pk>/cycles/<pk>/prepare/` | Mark a draft/needs-changes cycle as PREPARED (records preparer). | BLISTER_MARK_PREPARED (admin, pharmacist) | mutation |
| POST | `/api/patients/<patient_pk>/cycles/<pk>/cancel/` | Cancel a draft/prepared cycle (blocked once stock deducted). | BLISTER_MANAGE (admin, pharmacist) | mutation |
| POST | `/api/patients/<patient_pk>/cycles/<pk>/status/` | Move cycle along lifecycle: checked (pharmacist-only via BLISTER_MARK_PREPARED) / collected / delivered / needs_changes (BLISTER_MARK_STATUS). | require(BLISTER_VIEW) gate; per-target in-view check: checked=BLISTER_MARK_PREPARED (admin,pharmacist); others=BLISTER_MARK_STATUS (admin,pharmacist,dispenser) | mutation |
| GET | `/api/patients/<patient_pk>/cycles/<cycle_pk>/picking-list/` | Picking list: per-medication daily quantities and totals for a cycle. | BLISTER_VIEW (admin, pharmacist, dispenser) | read |
| GET | `/api/patients/<patient_pk>/cycles/<cycle_pk>/stock-preview/` | Preview FEFO stock allocation/shortages for a cycle before deduction. | BLISTER_VIEW (admin, pharmacist, dispenser) | read |
| POST | `/api/patients/<patient_pk>/cycles/<cycle_pk>/deduct-stock/` | Deduct stock for a cycle; returns deduction summary, guards insufficient/already-deducted. | BLISTER_DEDUCT (admin, pharmacist) | mutation |
| GET | `/api/patients/<patient_pk>/dosette-periods/` | List a patient's dosette prep periods with their cycles. | BLISTER_VIEW (admin, pharmacist, dispenser) | read |
| POST | `/api/patients/<patient_pk>/dosette-periods/` | Submit/create a dosette prep period for a patient. | BLISTER_MANAGE (admin, pharmacist) | mutation |
| POST | `/api/patients/<patient_pk>/dosette-periods/<period_pk>/collected/` | Record collection of a dosette period (optional collected_on). | BLISTER_MANAGE (admin, pharmacist) | mutation |

## Inventory (`/api/inventory/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/inventory/stock-items/` | List stock items in scope; pharmacy filter and med/batch/pharmacy search. | STOCK_VIEW (all roles) | read |
| GET | `/api/inventory/stock-items/<pk>/` | Retrieve a stock item with its batches. | STOCK_VIEW (all roles) | read |
| POST | `/api/inventory/receipts/` | Receive stock into a stock item/batch (legacy manual receive); returns item+movement. | STOCK_MANAGE (admin, superintendent, stock_employee, pharmacist) | mutation |
| POST | `/api/inventory/stock/intake/` | Receive catalogue-product stock by pack count (pack-size intake); returns item+movement+intake. | STOCK_RECEIVE (all roles incl. dispenser) | mutation |
| POST | `/api/inventory/batches/<pk>/adjust/` | Adjust a batch's quantity with a reason (records movement). | STOCK_MANAGE (admin, superintendent, stock_employee, pharmacist) | mutation |
| POST | `/api/inventory/batches/<pk>/count/` | Reconcile a physical count against a batch (records movement if changed). | STOCK_MANAGE (admin, superintendent, stock_employee, pharmacist) | mutation |
| POST | `/api/inventory/batches/<pk>/transfer/` | Transfer stock from a source batch to another pharmacy (out+in movements). | STOCK_TRANSFER (admin, superintendent, stock_employee) | mutation |

## Catalogue (`/api/catalogue/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/catalogue/products/` | Search the reference catalogue products (dm+d); multi-term q filter, capped at 50. | MEDICATION_VIEW (all roles) | read |
| GET | `/api/catalogue/products/<pk>/` | Retrieve a single catalogue product. | MEDICATION_VIEW (all roles) | read |
| GET | `/api/catalogue/medications/` | List group-scoped medications. | MEDICATION_VIEW (all roles) | read |
| POST | `/api/catalogue/medications/` | Create a medication (audited). | MEDICATION_MANAGE (admin, superintendent, pharmacist) | mutation |
| GET | `/api/catalogue/medications/<pk>/` | Retrieve a single medication. | MEDICATION_VIEW (all roles) | read |
| PUT/PATCH | `/api/catalogue/medications/<pk>/` | Update a medication (audited). | MEDICATION_MANAGE (admin, superintendent, pharmacist) | mutation |

## Stock intelligence (`/api/analytics/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| POST | `/api/analytics/forecasts/` | Generate a stock forecast run for a pharmacy over a horizon. | FORECAST_RUN (admin, superintendent, stock_employee, pharmacist) | mutation |
| GET | `/api/analytics/forecasts/latest/` | Get the latest forecast run for a required pharmacy query param. | FORECAST_VIEW (all roles) | read |
| GET | `/api/analytics/forecasts/<pk>/` | Retrieve a forecast run by id; rechecks pharmacy scope. | FORECAST_VIEW (all roles); pharmacy-scoped | read |
| GET | `/api/analytics/transfer-suggestions/` | List transfer suggestions for a required group query param. | TRANSFER_SUGGESTION_VIEW (admin, superintendent) | read |
| POST | `/api/analytics/transfer-suggestions/` | Generate transfer suggestions for a group (dead_days threshold). | TRANSFER_SUGGESTION_GENERATE (admin, superintendent) | mutation |
| POST | `/api/analytics/transfer-suggestions/<pk>/dismiss/` | Dismiss a transfer suggestion. | TRANSFER_SUGGESTION_DISMISS (admin, superintendent) | mutation |
| GET | `/api/analytics/stock/overview/` | Aggregate stock overview KPIs; optional pharmacy filter. | STOCK_VIEW (all roles) | read |
| GET | `/api/analytics/mds-demand/` | MDS/dosette demand signal over a horizon (7-90 days); optional pharmacy filter. | STOCK_VIEW (all roles) | read |
| GET | `/api/analytics/expiry-risk/` | Expiry-risk analysis for stock; optional pharmacy filter. | STOCK_VIEW (all roles) | read |
| GET | `/api/analytics/stock-review-queue/` | Stock review queue over a horizon; optional pharmacy filter. | STOCK_VIEW (all roles) | read |

## Reports (`/api/reports/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/reports/dashboard/` | Reports dashboard summary; optional pharmacy/group filters. | IsActiveMember (any active member; all roles) | read |
| GET | `/api/reports/stock/attention/` | Stock-needing-attention report (flag/needs_attention filters). | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/stock/attention.csv` | CSV export of the stock-attention report. | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/stock/movements/` | Stock movements report (pharmacy/medication/stock_item/type/date/limit filters). | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/stock/movements.csv` | CSV export of the stock-movements report. | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/expiry/` | Expiry report within a window (days); optional pharmacy filter. | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/expiry.csv` | CSV export of the expiry report. | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/dead-stock/` | Dead-stock report (default 90-day window); optional pharmacy filter. | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/dead-stock.csv` | CSV export of the dead-stock report. | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/stock/valuation/` | Stock valuation report; optional pharmacy filter. | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/stock/valuation.csv` | CSV export of the stock-valuation report. | STOCK_VIEW (all roles) | read |
| GET | `/api/reports/forecast-reorder/` | Forecast-driven reorder report; optional pharmacy filter. | FORECAST_VIEW (all roles) | read |
| GET | `/api/reports/forecast-reorder.csv` | CSV export of the forecast-reorder report. | FORECAST_VIEW (all roles) | read |
| GET | `/api/reports/transfer-suggestions/` | Transfer-suggestions report (group/status filters). | TRANSFER_SUGGESTION_VIEW (admin, superintendent) | read |
| GET | `/api/reports/transfer-suggestions.csv` | CSV export of the transfer-suggestions report. | TRANSFER_SUGGESTION_VIEW (admin, superintendent) | read |
| GET | `/api/reports/mds-workload/` | MDS/dosette workload report within a window; optional pharmacy filter. | BLISTER_VIEW (admin, pharmacist, dispenser) | read |
| GET | `/api/reports/mds-workload.csv` | CSV export of the MDS-workload report. | BLISTER_VIEW (admin, pharmacist, dispenser) | read |

## Backups (`/api/backups/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/backups/schedule/` | Get (or lazily create) the backup schedule for a group. | Backup operator: admin or pharmacist (in-view role check; pharmacist scoped to own pharmacy's group) | read |
| PUT | `/api/backups/schedule/` | Update the group's backup schedule. | Backup operator: admin or pharmacist (in-view role check) | mutation |
| GET | `/api/backups/runs/` | List the 3 most recent backup runs for the group. | Backup operator: admin or pharmacist (in-view role check) | read |
| POST | `/api/backups/runs/now/` | Trigger an immediate backup run for the group. | Backup operator: admin or pharmacist (in-view role check) | mutation |
| POST | `/api/backups/runs/<pk>/restore/` | Restore a backup run (requires confirm string). | Backup admin: admin only (in-view role check) | mutation |
| DELETE | `/api/backups/runs/<pk>/` | Delete a backup run. | Backup admin: admin only (in-view role check) | mutation |

## Audit log (`/api/audit/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/audit/` | Paginated list of audit events in scope; optional action filter. | AUDIT_VIEW (admin, superintendent, pharmacist) | read |

## Reviews (`/api/reviews/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/reviews/` | List pharmacist reviews with status/priority/patient/assigned/overdue filters. | REVIEW_VIEW (admin, pharmacist, dispenser) | read |
| POST | `/api/reviews/` | Create a pharmacist review (starts PENDING). | REVIEW_MANAGE (admin, pharmacist) | mutation |
| GET | `/api/reviews/<pk>/` | Retrieve a single review. | REVIEW_VIEW (admin, pharmacist, dispenser) | read |
| PATCH | `/api/reviews/<pk>/` | Update a review (audited with changed fields). | REVIEW_MANAGE (admin, pharmacist) | mutation |
| POST | `/api/reviews/<pk>/complete/` | Mark a review as completed. | REVIEW_MANAGE (admin, pharmacist) | mutation |
| POST | `/api/reviews/<pk>/cancel/` | Cancel a review. | REVIEW_MANAGE (admin, pharmacist) | mutation |

## Notifications & work queue (`/api/notifications/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/notifications/alerts/` | List deterministic operational stock alerts in scope; optional pharmacy filter. | IsActiveMember (any active member; all roles) | read |
| GET | `/api/notifications/work-queue/` | Operational work-queue report in scope; optional pharmacy filter. | IsActiveMember (any active member; all roles) | read |
| POST | `/api/notifications/alerts/dismiss/` | Dismiss a single alert by fingerprint. | IsActiveMember (any active member; all roles) | mutation |
| POST | `/api/notifications/alerts/clear/` | Clear alerts (all in scope, or a provided list of fingerprints). | IsActiveMember (any active member; all roles) | mutation |

## Tenancy — groups & pharmacies (`/api/tenancy/`)

| Method | Path | Purpose | Permission / role | Kind |
| --- | --- | --- | --- | --- |
| GET | `/api/tenancy/groups/` | List groups. | GROUP_MANAGE (admin only) | read |
| POST | `/api/tenancy/groups/` | Create a group (audited). | GROUP_MANAGE (admin only) | mutation |
| GET | `/api/tenancy/groups/<pk>/` | Retrieve a single group. | GROUP_MANAGE (admin only) | read |
| PUT/PATCH | `/api/tenancy/groups/<pk>/` | Update a group (audited). | GROUP_MANAGE (admin only) | mutation |
| GET | `/api/tenancy/pharmacies/` | List pharmacies. | PHARMACY_MANAGE (admin only) | read |
| POST | `/api/tenancy/pharmacies/` | Create a pharmacy (audited). | PHARMACY_MANAGE (admin only) | mutation |
| GET | `/api/tenancy/pharmacies/<pk>/` | Retrieve a single pharmacy. | PHARMACY_MANAGE (admin only) | read |
| PUT/PATCH | `/api/tenancy/pharmacies/<pk>/` | Update a pharmacy (audited). | PHARMACY_MANAGE (admin only) | mutation |

## Notes

Complete enumeration from config/urls.py plus all apps/*/urls.py (including blister cycle_urls.py, period_urls.py and accounts user_urls.py), cross-referenced with each view. Total: 107 method+path endpoints (85 unique URL patterns).  PERMISSION MODEL (apps/tenancy/permissions.py): most views use require(Action.*) which calls can(user, action). Roles: ADMIN (bypasses all checks — passes every action), SUPERINTENDENT, STOCK_EMPLOYEE, PHARMACIST, DISPENSER. ROLE_CAPABILITIES defines each non-admin role's action set; the parenthetical role lists above already fold in ADMIN. Object-level scoping (pharmacy/group/patient) is enforced separately via scoped querysets (e.g. patients_for, StockItem.scoped.for_user, DosetteCycle.scoped.for_user) and _target_in_scope, so cross-pharmacy access is blocked even when the action passes.  Notable non-standard permission handling: - Blister appearance (PATCH .../appearance/) and cycle status (POST .../status/) are gated by require(BLISTER_VIEW) at the class level but perform a finer-grained can() check inside the view (BLISTER_MARK_STATUS or, for 'checked', BLISTER_MARK_PREPARED), returning 403 if it fails. - Backups app does NOT use the Action/require system. It reads the active Membership.role directly: _require_backup_operator allows ADMIN or PHARMACIST; _require_backup_admin allows ADMIN only. Group is resolved from query/body 'group' or the pharmacist's own pharmacy group. - ReportsDashboardView, all four notifications endpoints, and (implicitly) any authenticated view use IsActiveMember = any user with an active membership (all five roles).  RBAC quick reference (roles that satisfy each action, ADMIN always included): - stock.view / medication.view / forecast.view: ALL roles - stock.receive: ALL roles (incl. dispenser) - stock.manage / forecast.run / medication.manage: admin, superintendent, stock_employee (medication.manage excludes stock_employee), pharmacist — specifically stock.manage=admin/superintendent/stock_employee/pharmacist; forecast.run=admin/superintendent/stock_employee/pharmacist; medication.manage=admin/superintendent/pharmacist - stock.transfer: admin, superintendent, stock_employee - transfer_suggestion.* (view/generate/dismiss): admin, superintendent - patient.view / blister.view / review.view: admin, pharmacist, dispenser - blister.mark_status: admin, pharmacist, dispenser - patient.manage / blister.manage / blister.mark_prepared / blister.deduct / review.manage / user.* (create/reset/deactivate/assign_role/manage): admin, pharmacist - user.delete / group.manage / pharmacy.manage: admin only - audit.view: admin, superintendent, pharmacist  DRF generics expose HEAD/OPTIONS implicitly; PUT+PATCH on RetrieveUpdateAPIView rows are collapsed into "PUT/PATCH". ReviewDetailView restricts to GET/PATCH only (no PUT); CatalogueProductDetailView is GET-only. No DELETE exists for patients (deactivate instead), medications, reviews, or cycles; user hard-DELETE and backup-run DELETE are the only DELETE endpoints. Health check is public (also mounted at "/"). login/csrf are AllowAny; login has a scoped rate throttle.
