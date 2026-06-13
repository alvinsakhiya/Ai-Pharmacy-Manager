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
| Forecasting | `apps/forecasting/tests.py` | empty history handled, moving-average for short series, trend detected & CI widens with horizon, reorder recommendation, forecast API shape |
| Dosette & picking | `apps/dosette/tests.py` | dose-per-week counting, cycle generation & due dates, pharmacist-only final check, picking-list demand aggregation |

## Frontend

`npm run lint` runs ESLint. Component-level testing (React Testing Library) and Playwright
end-to-end flows are identified as future work in the [roadmap](roadmap.md).

## Continuous integration (recommended)

A GitHub Actions workflow should run, on every push/PR: `pip install` → `pytest` (backend) and
`npm ci` → `npm run build` + `npm run lint` (frontend). This is listed in the roadmap and is a small
addition given the test suite already exists.
