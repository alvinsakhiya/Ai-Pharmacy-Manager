# Phase 1 Acceptance Criteria and Evidence

## Phase 1 Purpose and Scope

Phase 1 establishes the technical foundation for the pharmacy system. Its focus is identity, session-based authentication, CSRF handling, multi-pharmacy tenancy, role-based access control, tenant scoping, auditability, management screens, and safe local demo data.

Phase 1 is not the full pharmacy application yet. It does not implement medication master data, stock and inventory workflows, patient records, blister-pack/dosette/MDS workflows, AI forecasting, real operational dashboards, reports, or full clinical workflows. Those areas are Phase 2+ or later work.

## Evidence Conventions

Evidence in this document is based on automated tests and CI results. Criteria are described as "verified by" or "exercised by" test suites and implementation paths. This document does not claim exhaustive coverage or production readiness.

Backend CI reported `221 passing cases` as of commit `1e3bb97` and CI run `27709843398`. Frontend CI reported `79 tests across 13 files` as of commit `1e3bb97` and CI run `27709843398`. These are suite results, not unique scenario counts; pytest parametrization can expand a smaller number of test functions into many cases. No coverage percentage is claimed.

Status markers:

- ✅ Implemented
- 🟡 Partial / intentionally deferred
- ⏭️ Deferred to Phase 2+

## A. Roles and Access Model

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| Admin role exists for global application administration. | `backend/apps/tenancy/models.py`, `backend/apps/tenancy/permissions.py`, `backend/apps/tenancy/policy.py` | Verified by `backend/apps/tenancy/test_policy.py` and exercised by account/auth API tests in `backend/apps/accounts/test_auth_api.py`. | ✅ Implemented |
| Superintendent role exists as a group-scoped role. | `backend/apps/tenancy/models.py`, `backend/apps/tenancy/policy.py` | Verified by tenancy model and policy tests in `backend/apps/tenancy/test_models.py` and `backend/apps/tenancy/test_policy.py`. | ✅ Implemented |
| Stock employee role exists with selected-pharmacy scope. | `backend/apps/tenancy/models.py`, `backend/apps/tenancy/signals.py`, `backend/apps/tenancy/policy.py` | Verified by `backend/apps/tenancy/test_models.py` and `backend/apps/tenancy/test_scoping.py`. | ✅ Implemented |
| Pharmacist role exists as a pharmacy-scoped management role. | `backend/apps/tenancy/models.py`, `backend/apps/tenancy/permissions.py`, `backend/apps/tenancy/policy.py` | Verified by `backend/apps/tenancy/test_policy.py`, `backend/apps/accounts/test_users_api.py`, and `backend/apps/accounts/test_membership_api.py`. | ✅ Implemented |
| Dispenser role exists as a pharmacy-scoped read/workflow role foundation. | `backend/apps/tenancy/models.py`, `backend/apps/tenancy/permissions.py`, `backend/apps/tenancy/policy.py` | Verified by `backend/apps/tenancy/test_policy.py` and route/permission behavior in account API tests. | ✅ Implemented |
| Frontend role and permission state is available for UX gating. | `frontend/src/auth/`, `frontend/src/app/` | Exercised by frontend auth/app tests including `frontend/src/app/ProtectedRoute.test.tsx`, `frontend/src/components/nav/Sidebar.test.tsx`, and `frontend/src/auth/usePermissions.test.tsx`. | ✅ Implemented |

## B. Tenancy Model

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| Group model represents an organisation group. | `backend/apps/tenancy/models.py` | Verified by `backend/apps/tenancy/test_models.py` and API tests in `backend/apps/tenancy/test_tenancy_api.py`. | ✅ Implemented |
| Pharmacy model belongs to a group and has per-group code uniqueness. | `backend/apps/tenancy/models.py` | Verified by `backend/apps/tenancy/test_models.py` and `backend/apps/tenancy/test_tenancy_api.py`. | ✅ Implemented |
| Membership model links a user to exactly one active role/scope at a time. | `backend/apps/tenancy/models.py` | Verified by `backend/apps/tenancy/test_models.py` and membership API tests in `backend/apps/accounts/test_membership_api.py`. | ✅ Implemented |
| Role/scope constraints enforce valid role combinations. | `backend/apps/tenancy/models.py` | Verified by `backend/apps/tenancy/test_models.py`. | ✅ Implemented |
| Stock employee selected pharmacies are constrained to the membership group. | `backend/apps/tenancy/models.py`, `backend/apps/tenancy/signals.py` | Verified by `backend/apps/tenancy/test_models.py` and `backend/apps/core/test_seed_demo.py`. | ✅ Implemented |
| Shared tenant-scoped manager foundation exists. | `backend/apps/core/models.py` | Verified by `backend/apps/tenancy/test_scoping.py` and `backend/apps/core/test_models.py`. | ✅ Implemented |

## C. RBAC Capability Matrix

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| Backend permission policy is the source of truth. | `backend/apps/tenancy/permissions.py` | Verified by `backend/apps/tenancy/test_policy.py` and exercised by account, tenancy, and audit API tests. | ✅ Implemented |
| Frontend navigation and route gating are UX-only. | `frontend/src/auth/usePermissions.ts`, `frontend/src/app/RequirePermission.tsx`, `frontend/src/app/navConfig.ts` | Exercised by `frontend/src/components/nav/Sidebar.test.tsx`, `frontend/src/components/nav/TopBar.test.tsx`, and app route tests. | ✅ Implemented |
| Users see role-appropriate UI affordances. | `frontend/src/auth/usePermissions.ts`, `frontend/src/app/`, `frontend/src/features/users/`, `frontend/src/features/tenancy/`, `frontend/src/features/audit/` | Exercised by frontend screen and navigation tests. | ✅ Implemented |

## D. Cross-Tenant Isolation and 404-not-403 Behaviour

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| Tenant scoping is backend-enforced. | `backend/apps/tenancy/policy.py`, `backend/apps/core/models.py` | Verified by `backend/apps/tenancy/test_scoping.py`, `backend/apps/accounts/test_users_api.py`, and `backend/apps/accounts/test_membership_api.py`. | ✅ Implemented |
| Cross-tenant object access returns 404 where appropriate. | `backend/apps/accounts/user_views.py`, `backend/apps/tenancy/policy.py` | Verified by scoped user and membership API tests in `backend/apps/accounts/test_users_api.py` and `backend/apps/accounts/test_membership_api.py`. | ✅ Implemented |
| Capability denial returns 403. | `backend/apps/tenancy/permissions.py`, API views using permission guards | Verified by `backend/apps/accounts/test_users_api.py`, `backend/apps/accounts/test_membership_api.py`, and `backend/apps/tenancy/test_tenancy_api.py`. | ✅ Implemented |

## E. Patient-Data Exclusion for Group-Level Roles

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| Patient modules are not implemented in Phase 1. | No patient feature package is present in Phase 1. | Confirmed by project scope and absence of patient feature implementation. | ⏭️ Deferred to Phase 2+ |
| Group-level roles do not receive patient-class capabilities in the current policy. | `backend/apps/tenancy/permissions.py` | Verified by `backend/apps/tenancy/test_policy.py`. | ✅ Implemented |
| Patient safety is treated as a foundation-level invariant, not a complete patient-data module. | `backend/apps/tenancy/permissions.py` | Exercised by policy tests; complete patient workflows remain out of scope. | 🟡 Partial / intentionally deferred |

## F. Authentication, Session, and CSRF Foundation

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| CSRF endpoint exists for browser session setup. | `backend/apps/accounts/views.py`, `backend/apps/accounts/urls.py` | Verified by `backend/apps/accounts/test_auth_api.py`; consumed by frontend auth code in `frontend/src/auth/`. | ✅ Implemented |
| Login endpoint supports session-based authentication. | `backend/apps/accounts/views.py`, `backend/apps/accounts/serializers.py` | Verified by `backend/apps/accounts/test_auth_api.py`. | ✅ Implemented |
| Logout endpoint clears the session. | `backend/apps/accounts/views.py` | Verified by `backend/apps/accounts/test_auth_api.py`. | ✅ Implemented |
| `/me` endpoint returns authenticated user, role, scope, pharmacies, and permissions. | `backend/apps/accounts/views.py` | Verified by `backend/apps/accounts/test_auth_api.py`; consumed by `frontend/src/auth/`. | ✅ Implemented |
| Password change endpoint supports authenticated password changes. | `backend/apps/accounts/views.py`, `backend/apps/accounts/serializers.py` | Verified by `backend/apps/accounts/test_auth_api.py`. | ✅ Implemented |

## G. User Management Workflows

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| Users can be listed in the caller's permitted scope. | `backend/apps/accounts/user_views.py`, `backend/apps/accounts/selectors.py` | Verified by `backend/apps/accounts/test_users_api.py`; exercised in `frontend/src/features/users/`. | ✅ Implemented |
| User creation supports valid role/scope assignment. | `backend/apps/accounts/user_views.py`, `backend/apps/accounts/serializers.py` | Verified by `backend/apps/accounts/test_users_api.py` and frontend user screen tests. | ✅ Implemented |
| Deactivate, reset password, and delete behavior exists where allowed. | `backend/apps/accounts/user_views.py`, `backend/apps/accounts/services.py` | Verified by `backend/apps/accounts/test_users_api.py`; frontend reset/deactivate UI is in `frontend/src/features/users/`. | ✅ Implemented |
| Duplicate email handling returns validation errors instead of unhandled integrity errors. | `backend/apps/accounts/serializers.py` | Verified by `backend/apps/accounts/test_users_api.py`. | ✅ Implemented |
| Passwords are not leaked in responses or audit metadata. | `backend/apps/accounts/serializers.py`, `backend/apps/accounts/user_views.py` | Verified by `backend/apps/accounts/test_users_api.py` and audit service tests. | ✅ Implemented |
| User management remains scoped by tenancy and permissions. | `backend/apps/accounts/user_views.py`, `backend/apps/tenancy/policy.py` | Verified by `backend/apps/accounts/test_users_api.py`. | ✅ Implemented |

## H. Membership Reassignment Workflow

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| Membership reassignment endpoint exists. | `backend/apps/accounts/user_views.py`, `backend/apps/accounts/services.py` | Verified by `backend/apps/accounts/test_membership_api.py`. | ✅ Implemented |
| Reassignment uses transaction-safe service logic. | `backend/apps/accounts/services.py` | Verified by rollback and validation behavior in `backend/apps/accounts/test_membership_api.py`. | ✅ Implemented |
| Role/scope validation is applied during reassignment. | `backend/apps/accounts/services.py`, `backend/apps/accounts/serializers.py`, `backend/apps/tenancy/models.py` | Verified by `backend/apps/accounts/test_membership_api.py`. | ✅ Implemented |
| Frontend reassignment UI prepares role/scope payloads. | `frontend/src/features/users/ReassignMembershipModal.tsx`, `frontend/src/features/users/assignmentBody.ts` | Exercised by frontend user management tests. | ✅ Implemented |

## I. Organisation Management

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| Group management API exists. | `backend/apps/tenancy/views.py`, `backend/apps/tenancy/serializers.py` | Verified by `backend/apps/tenancy/test_tenancy_api.py`; frontend UI in `frontend/src/features/tenancy/`. | ✅ Implemented |
| Pharmacy management API exists. | `backend/apps/tenancy/views.py`, `backend/apps/tenancy/serializers.py` | Verified by `backend/apps/tenancy/test_tenancy_api.py`; frontend UI in `frontend/src/features/tenancy/`. | ✅ Implemented |
| Duplicate group slug and pharmacy code validation is handled cleanly. | `backend/apps/tenancy/serializers.py` | Verified by `backend/apps/tenancy/test_tenancy_api.py`. | ✅ Implemented |
| Organisation management is admin-only. | `backend/apps/tenancy/views.py`, `backend/apps/tenancy/permissions.py` | Verified by `backend/apps/tenancy/test_tenancy_api.py`. | ✅ Implemented |

## J. Audit Foundation

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| `AuditEvent` model records structured audit data. | `backend/apps/audit/models.py` | Verified by `backend/apps/audit/test_models.py` and admin registration tests in `backend/apps/audit/test_admin.py`. | ✅ Implemented |
| App-level append-only behavior blocks normal instance updates/deletes. | `backend/apps/audit/models.py` | Verified by `backend/apps/audit/test_models.py`. Database-level immutability remains deferred. | 🟡 Partial / intentionally deferred |
| Central audit service records events with actor, scope, target, request, and metadata context. | `backend/apps/audit/services.py` | Verified by `backend/apps/audit/test_services.py`. | ✅ Implemented |
| Login, logout, and failed-login signals are audited. | `backend/apps/audit/signals.py` | Verified by `backend/apps/audit/test_signals.py`. | ✅ Implemented |
| Failed-login audit does not store passwords. | `backend/apps/audit/signals.py`, `backend/apps/audit/services.py` | Verified by `backend/apps/audit/test_signals.py` and account auth tests. | ✅ Implemented |
| Transaction-bound mutation audit exists for implemented management workflows. | `backend/apps/accounts/user_views.py`, `backend/apps/tenancy/views.py`, `backend/apps/audit/services.py` | Verified by user, membership, tenancy, and audit service tests. | ✅ Implemented |

## K. Read-Only Audit API and UI

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| `GET /api/audit/` provides a read-only audit listing endpoint. | `backend/apps/audit/views.py`, `backend/apps/audit/urls.py` | Verified by `backend/apps/audit/test_audit_api.py`. | ✅ Implemented |
| Audit API uses a paginated response. | `backend/apps/audit/pagination.py`, `backend/apps/audit/views.py` | Verified by `backend/apps/audit/test_audit_api.py`. | ✅ Implemented |
| Admin sees all audit events. | `backend/apps/audit/selectors.py` | Verified by `backend/apps/audit/test_audit_api.py`. | ✅ Implemented |
| Pharmacist sees own-pharmacy audit events. | `backend/apps/audit/selectors.py` | Verified by `backend/apps/audit/test_audit_api.py`. | ✅ Implemented |
| Superintendent receives empty audit results for now. | `backend/apps/audit/selectors.py` | Verified by `backend/apps/audit/test_audit_api.py`; group-scoped audit visibility is intentionally deferred. | 🟡 Partial / intentionally deferred |
| Stock employee and dispenser receive 403 for audit listing. | `backend/apps/tenancy/permissions.py`, `backend/apps/audit/views.py` | Verified by `backend/apps/audit/test_audit_api.py`. | ✅ Implemented |
| Frontend audit screen consumes `{ count, next, previous, results }`. | `frontend/src/features/audit/` | Verified by `frontend/src/features/audit/AuditScreen.test.tsx`. | ✅ Implemented |

## L. Seed and Demo Data Command

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| `python manage.py seed_demo` command exists. | `backend/apps/core/management/commands/seed_demo.py` | Verified by `backend/apps/core/test_seed_demo.py`. | ✅ Implemented |
| Command is dev-gated and requires `--force` when `DEBUG=False`. | `backend/apps/core/management/commands/seed_demo.py` | Verified by `backend/apps/core/test_seed_demo.py`. | ✅ Implemented |
| Command is idempotent. | `backend/apps/core/management/commands/seed_demo.py` | Verified by `backend/apps/core/test_seed_demo.py`. | ✅ Implemented |
| Command creates JMW group and three pharmacies. | `backend/apps/core/management/commands/seed_demo.py` | Verified by `backend/apps/core/test_seed_demo.py`. | ✅ Implemented |
| Command creates one demo user per Phase 1 role with a known local demo password. | `backend/apps/core/management/commands/seed_demo.py` | Verified by `backend/apps/core/test_seed_demo.py`. | ✅ Implemented |
| Command does not create patient, stock feature, or fabricated audit data. | `backend/apps/core/management/commands/seed_demo.py` | Verified by `backend/apps/core/test_seed_demo.py`. | ✅ Implemented |

## M. CI Verification

| Criterion | Implemented in | Evidence | Status |
| --- | --- | --- | --- |
| CI workflow exists for backend and frontend. | `.github/workflows/ci.yml` | Latest green evidence: CI run `27709843398` at commit `1e3bb97`. | ✅ Implemented |
| Backend CI uses PostgreSQL 17 service. | `.github/workflows/ci.yml` | Workflow declares `postgres:17-alpine` with `pg_isready` health check. | ✅ Implemented |
| Backend CI runs lint, format check, mypy, and pytest. | `.github/workflows/ci.yml` | Backend suite reported `221 passing cases` as of commit `1e3bb97` / CI run `27709843398`. | ✅ Implemented |
| Frontend CI runs install, lint, build, and tests. | `.github/workflows/ci.yml` | Frontend suite reported `79 tests across 13 files` as of commit `1e3bb97` / CI run `27709843398`. | ✅ Implemented |

## Deferred and Out of Scope

| Item | Status |
| --- | --- |
| Medication master | ⏭️ Deferred to Phase 2+ |
| Inventory/stock workflows | ⏭️ Deferred to Phase 2+ |
| Patient records | ⏭️ Deferred to Phase 2+ |
| Blister-pack/dosette/MDS workflows | ⏭️ Deferred to Phase 2+ |
| AI forecasting/analytics | ⏭️ Deferred to Phase 2+ |
| Live dashboard metrics | ⏭️ Deferred to Phase 2+ |
| Reports | ⏭️ Deferred to Phase 2+ |
| Deeper settings/accessibility work | ⏭️ Deferred to Phase 2+ |
| Field-level patient-data encryption | ⏭️ Deferred to Phase 2+ |
| DB-level audit immutability, triggers, or row-level security | ⏭️ Deferred to Phase 2+ |
| Superintendent group-scoped audit visibility | 🟡 Partial / intentionally deferred |
| Playwright E2E tests | ⏭️ Deferred to Phase 2+ |

## Safety and Privacy

Implemented Phase 1 safety and privacy foundations:

- Django password hashing for user credentials.
- Session authentication and CSRF foundation.
- Production security settings where already present in the settings modules.
- App-level append-only audit behavior for normal model instance updates/deletes.
- Failed-login audit does not store the attempted password.
- Group-level roles have no patient-class capability in the current backend permission policy.
- Demo seed data uses fictional `@demo.local` accounts and creates no real patient, NHS, customer, or stock feature data.

Explicit non-claims:

- This phase does not claim production readiness.
- This phase does not claim NHS integration.
- This phase does not claim a complete real patient-data module.
- This phase does not claim GDPR certification.
- This phase does not claim full post-quantum cryptography compliance. Crypto-agility and PQC-ready design can be considered as a future security direction.

## Appendix: Local Verification Commands

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
```

Demo seed:

```bash
cd backend
python manage.py seed_demo
```
