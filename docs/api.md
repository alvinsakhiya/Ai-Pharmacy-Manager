# API Reference

Base URL: `/api`. All endpoints except login/refresh require `Authorization: Bearer <access>`.
Interactive docs: `/api/docs/` (Swagger), `/api/redoc/`, raw schema at `/api/schema/`.

List endpoints are paginated (`page`, `page_size`, default 25) and support `search`, `ordering`
and field filters where noted.

## Authentication

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/login/` | `{username, password}` | → `{access, refresh, user}`; writes an audit entry |
| POST | `/auth/refresh/` | `{refresh}` | → `{access, refresh}` (rotated) |
| GET | `/auth/me/` | — | Current user profile |

## Accounts (RBAC)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET/POST | `/users/` | Administrator | Staff management; filters `role`, `is_active` |
| GET/PUT/PATCH/DELETE | `/users/{id}/` | Administrator | |
| GET | `/audit-logs/` | Pharmacist, Admin | Read-only; filters `action`, `entity`, `actor` |

## Patients

| Method | Path | Notes |
|---|---|---|
| GET | `/patients/` | filters `status`, `is_dosette`; search id/name/postcode |
| POST/PUT/PATCH | `/patients/` | Pharmacist/Admin; audited |
| GET | `/patients/{id}/` | includes notes (history) |
| GET/POST | `/patient-notes/` | filter `patient`, `category` |

## Trusted directions

| Method | Path | Notes |
|---|---|---|
| GET | `/trusted-directions/` | Authenticated, read-only approved label phrases; `q` searches code/text and exact shortcut codes rank first |
| GET | `/trusted-directions/?category=timing` | Optional category filter: `dose`, `timing`, `route`, `qualifier`, `general` |

The direction library is typing assistance only. Selecting a phrase does not
confirm a prescription item or perform a clinical decision.

## Stock

| Method | Path | Notes |
|---|---|---|
| GET | `/medicines/` | filters `form`, `is_active`, `manufacturer`, `default_supplier` |
| GET | `/medicines/{id}/` | includes FEFO-ordered in-stock batches |
| GET | `/medicines/low_stock/` | medicines at/below reorder level |
| POST | `/medicines/{id}/fefo-preview/` | `{quantity}` → dry-run FEFO allocation |
| GET/POST | `/batches/` | filters `medicine`, `supplier`, `location`, `expiry_within=30\|90\|180`, `expired=true` |
| GET | `/movements/` | append-only ledger; filters `kind`, `batch`, `batch__medicine` |
| POST | `/movements/adjust/` | `{batch, quantity, kind: adjust\|waste\|return, reason}`; audited |
| GET/POST | `/suppliers/`, `/manufacturers/` | Pharmacist/Admin |

## Dosette

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/dosette-plans/` | filters `is_active`, `frequency`, `patient` |
| GET | `/dosette-plans/{id}/` | includes items + per-cycle dose totals |
| POST | `/dosette-plans/{id}/generate-cycle/` | create next cycle with proactive due date |
| GET | `/dosette-plans/{id}/export-pdf/` | printable patient compliance-pack summary (day × slot grid) |
| GET/POST | `/dosette-items/` | filter `plan` |
| GET | `/dosette-cycles/` | filters `status`, `plan`; ordering `due_date` |
| POST | `/dosette-cycles/{id}/assemble/` | mark assembled |
| POST | `/dosette-cycles/{id}/final_check/` | **Pharmacist/Admin only** |
| POST | `/dosette-cycles/{id}/seal/` | seal after final check |

## Picking

| Method | Path | Notes |
|---|---|---|
| GET | `/picking-lists/` | filter `status` |
| POST | `/picking-lists/generate/` | `{period_start?, weeks?}` → aggregated list |
| GET | `/picking-lists/{id}/export-pdf/` | PDF download |
| POST | `/picking-items/{id}/toggle-picked/` | toggle completion, refreshes list status |

## Dispensing workflow

| Method | Path | Notes |
|---|---|---|
| GET | `/workflow-jobs/board/` | Store-wide jobs grouped by status with counts and explainable prompts |
| POST | `/workflow-jobs/{id}/transition/` | Audited legal status transition; pharmacist-only accuracy sign-off |
| POST | `/workflow-jobs/{id}/raise-issue/` | Park an active job with a required issue note |
| POST | `/workflow-jobs/{id}/resolve-issue/` | Pharmacist/Admin resolution back into the workflow |
| GET | `/workflow-jobs/{id}/history/` | Append-only status history |

## Forecasting

| Method | Path | Notes |
|---|---|---|
| GET | `/forecast/medicine/{id}/?horizon=4` | full explainable forecast + reorder rec |
| GET | `/forecast/medicine/{id}/backtest/` | rolling-origin model-evaluation report: MAE/RMSE/MAPE/MASE per method vs naive baselines, skill score, best method |
| GET | `/forecast/shortages/` | medicines predicted to need reordering |
| GET | `/forecast/summary/` | dashboard headline numbers |

## Notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications/` | filters `level`, `category`, `is_read` |
| GET | `/notifications/unread_count/` | badge count |
| POST | `/notifications/{id}/mark-read/` | |
| POST | `/notifications/mark-all-read/` | |
| POST | `/notifications/refresh/` | re-scan state & (re)generate alerts |

## Reports & dashboard

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard/` | aggregated KPIs, expiry exposure, recent activity |
| GET | `/dashboard/stock-trend/?days=90` | daily dispensed-units series |
| GET | `/reports/` | available report keys |
| GET | `/reports/{key}/?format=json\|csv\|pdf` | keys: `stock-valuation`, `expiry`, `low-stock`, `dosette-workload`, `forecasting`, `patient-summary` |

### Example

```bash
TOKEN=$(curl -s localhost:8000/api/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"pharmacist","password":"Password123!"}' | python -c 'import sys,json;print(json.load(sys.stdin)["access"])')

curl -s localhost:8000/api/forecast/medicine/1/?horizon=6 -H "Authorization: Bearer $TOKEN"
```
