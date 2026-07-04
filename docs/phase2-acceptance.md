# Phase 2 Acceptance Criteria and Evidence

## Purpose

This document records Phase 2 implementation and verification evidence for the
academic pharmacy stock optimisation and Dosette/MDS prototype. Phase 2 extends
the Phase 1 foundation with medication, stock, patient, Dosette/MDS, analytics,
reporting, alerting, and pharmacist review workflows.

## Evidence Conventions and Disclaimers

Evidence is based on repository implementation paths, automated tests, tags, and
verified suite results. Test counts are suite results, not unique scenario
counts; pytest parametrization can expand a smaller number of test functions
into many reported cases. No coverage percentage is claimed.

This document does not claim production readiness, NHS integration, clinical
decision-making, diagnosis, automated clinical recommendation, regulatory
compliance, or clinical safety certification. Screenshots and CI run links
should be added when preparing the final submission package.

Status marker:

- ✅ Implemented and verified

## Phase 2 Module Evidence

| Module | Status | Description | Key backend/frontend evidence | Tests and E2E evidence | Tag |
| --- | --- | --- | --- | --- | --- |
| 5 | ✅ Implemented and verified | Medication catalogue for tenant-scoped medicine master data. | `apps/catalogue`; medication list/create/detail API; `/catalogue` frontend. | Catalogue backend and frontend tests. | `module-5-medication-master-complete` |
| 6 | ✅ Implemented and verified | Inventory, stock items, batches, receiving, adjustment, count reconciliation, transfers, and append-only movement history. | `apps/inventory`; stock item, receipt, adjustment, count, transfer endpoints; `/inventory` frontend. | Inventory backend/frontend tests and inventory Playwright smoke tests. | `module-6-inventory-complete` |
| 7 | ✅ Implemented and verified | Patient records, encrypted PII fields, blind-index search, notes, scoped patient frontend. | `apps/patients`; patient and note endpoints; `/patients` and patient detail frontend. | Patient backend/frontend tests and patient Playwright smoke tests. | `module-7-patient-feature-complete` |
| 8 | ✅ Implemented and verified | Dosette/MDS patient medication lines, cycles, preparation workflow, and picking list. | `apps/blister`; medication-line and cycle endpoints; `/patients/:id/dosette` frontend. | Dosette backend/frontend tests and Dosette Playwright smoke tests. | `module-8-dosette-mds-feature-complete` |
| 9 | ✅ Implemented and verified | Stock-aware Dosette/MDS preview with stock availability, shortage, and FEFO batch suggestions. | Stock preview endpoint under Dosette/MDS cycle workflow; Dosette stock availability UI. | Backend stock preview tests and Dosette UI/E2E coverage. | `module-9-stock-aware-dosette-preview-complete` |
| 10 | ✅ Implemented and verified | Safe stock deduction for prepared Dosette/MDS cycles, append-only deduction movements, and cancellation guard after deduction. | Deduct-stock endpoint; `BLISTER_DEDUCTION` StockMovement rows; cycle `stock_deducted` state. | Backend deduction/cancellation tests and Dosette deduction Playwright smoke. | `module-10-dosette-stock-deduction-complete` |
| 11 | ✅ Implemented and verified | Stock Intelligence analytics overview for operational stock attention. | `apps/analytics`; `/api/analytics/stock/overview/`; `/analytics` frontend. | Analytics backend/frontend tests and Stock Intelligence E2E smoke. | `module-11-stock-intelligence-analytics-complete` |
| 12 | ✅ Implemented and verified | Stock reports and CSV exports for attention and movement history. | `apps/reports`; `/api/reports/stock/attention/`, `.csv`, `/movements/`, `.csv`; `/reports` frontend. | Reports backend/frontend tests and stock reports E2E smoke. | `module-12-reports-exports-complete` |
| 13 | ✅ Implemented and verified | Live-computed operational notifications and alerts. | `apps/notifications`; `/api/notifications/alerts/`; `/alerts` frontend. | Notifications backend/frontend tests and alerts E2E smoke. | `module-13-notifications-alerts-complete` |
| 14 | ✅ Implemented and verified | Pharmacist review workflow with queue, patient section, create/complete/cancel, encrypted notes, and audit-backed mutations. | `apps/reviews`; `/api/reviews/`, detail, complete, cancel endpoints; `/reviews` and patient review section frontend. | Reviews backend/frontend tests and pharmacist review workflow E2E smoke. | `module-14-pharmacist-review-workflow-complete` |

Additional actual repository tags relevant to Phase 2 include
`module-6-inventory-backend-complete`, `module-7-patient-backend-complete`, and
`module-7b-patient-encryption-search-complete`.

## Verification Summary (as of tag `module-14-pharmacist-review-workflow-complete`, 2026-06-20)

- Backend PostgreSQL: 589 passing cases
- Frontend: 237 tests across 36 files
- Playwright E2E: 23/23 passing
- Tag at the time of this verification: `module-14-pharmacist-review-workflow-complete`

Final submission evidence placeholders:

- CI run link:
- E2E run link:
- Screenshots folder/link:
- Final report section references:

## Safety and Privacy Guardrail Summary

- Tenant scoping is backend-enforced across implemented modules.
- RBAC controls backend access; frontend route/nav gating is UX-only.
- Patient PII fields are encrypted using `EncryptedTextField`.
- Pseudonymous `patient_reference` values are used where possible in UI and
  audit contexts.
- Audit metadata is designed to remain PII-free.
- Audit events are append-only at application level.
- Stock movements are append-only at application level; corrections use new
  movement rows rather than editing movement history.
- Seed data is fictional demo data only.
- There is no NHS integration.
- There is no clinical diagnosis, automated clinical recommendation, or
  compliance claim.
- Pharmacist review records are operational workflow records, not clinical
  decision automation.

## Verification Commands

Backend:

```bash
cd backend
ruff check .
ruff format --check .
mypy .
python manage.py makemigrations --check --dry-run
python manage.py check
pytest
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
npm run test
npm run e2e
```

Demo seed:

```bash
cd backend
python manage.py seed_demo
```
