# Testing Strategy

## Philosophy

Tests concentrate on the **business invariants** that make this system trustworthy — FEFO
allocation, role-based authorisation, forecasting behaviour and dosette/picking logic — rather than
on framework plumbing. The service layer is pure and HTTP-free, so most logic is unit-tested
directly; API tests cover auth, permissions and serialisation end-to-end via DRF's `APIClient`.

## Running

```bash
cd backend
pytest                 # all tests (uses --reuse-db for speed)
pytest apps/stock      # a single app
pytest -k fefo         # by keyword
```

`pytest-django` builds a fresh test database from migrations; fixtures in `conftest.py` provide
users (one per role), an authenticated client factory, and a medicine with two batches.

## Coverage map

| Area | File | What it asserts |
|---|---|---|
| FEFO allocation | `apps/stock/tests.py` | soonest-expiry-first ordering, expired batches skipped, shortfall raises, on-hand & low-stock aggregates, expiry banding |
| Auth & RBAC | `apps/accounts/tests.py` | login returns tokens+user, bad password rejected, unauthenticated 401, dispenser blocked from writes, admin-only user list, login audit entry |
| Patient access | `apps/patients/tests.py` | admin-only full list, limited staff search, minimum query validation and disabled hard deletion |
| Forecasting | `apps/forecasting/tests.py` | empty history handled, moving-average for short series, trend detected & CI widens with horizon, reorder recommendation, forecast API shape |
| Dosette & picking | `apps/dosette/tests.py`, `apps/picking/tests.py` | schedule/day/slot validation, duplicate medicine prevention, cycle state transitions, pharmacist-only final check and demand aggregation |
| Notifications | `apps/notifications/tests.py` | generated alerts are read-only through CRUD endpoints and refresh is role-restricted |
| Dashboard queries | `apps/reports/tests.py` | stock-trend query validation and bounded date ranges |

## Frontend

```bash
cd frontend
npm run lint
npm test
npm run build
```

Vitest and React Testing Library cover keyboard sorting/row activation in `DataTable` and modal
labelling, initial focus and Escape handling. Browser-level end-to-end coverage remains future work.

## Continuous integration (recommended)

A GitHub Actions workflow should run, on every push/PR: `pip install` → `pytest` (backend) and
`npm ci` → `npm run lint` + `npm test` + `npm run build` (frontend). This remains a recommended
next step.
