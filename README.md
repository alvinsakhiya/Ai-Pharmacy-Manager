# Pharmacy Stock and Dosette Management System

AI-enhanced pharmacy stock optimisation and patient dosette management system
built with React, Django REST Framework, JWT authentication, and PostgreSQL.

## Local Development

1. Copy `backend/.env.example` to `backend/.env` and enter your local PostgreSQL
   credentials.
2. Install backend dependencies with
   `pip install -r backend/requirements.txt`.
3. Run migrations from `backend` with `python manage.py migrate`.
4. Start Django with `python manage.py runserver`.
5. Install frontend dependencies with `npm install` from `frontend`.
6. Start Vite with `npm run dev`.

The local frontend defaults to `http://localhost:5173` and the API defaults to
`http://127.0.0.1:8000/api`.

## Deployment

Production deployment instructions for Render or Railway, Vercel, PostgreSQL,
environment variables, migrations, and verification are in
[docs/deployment.md](docs/deployment.md).

## Staff Roles

The system includes Django Group-based access for Managers, Pharmacists,
Dispensers, Stock Assistants, and Read-only Users. The access matrix and account
assignment steps are documented in
[docs/access-control.md](docs/access-control.md).

## Stock Governance

Quantity changes use a controlled, reason-based adjustment endpoint and an
immutable stock movement ledger. The movement rules, API examples, migration
behaviour, and picking-list trade-off are documented in
[docs/stock-governance.md](docs/stock-governance.md).

## Clinical Reviews

Managers and Pharmacists can record structured, authored patient reviews with
follow-up dates and statuses. The data boundary, role restrictions, safe audit
behaviour, API filters, and demonstration scope are documented in
[docs/clinical-reviews.md](docs/clinical-reviews.md).

## Dosette Operations

Patient records include a simple local care-setting group, while dosette
schedules support cycle start dates, validated cycle lengths, review dates, and
immutable medication-change history. Existing FEFO, picking, and forecast
calculations remain unchanged. The compatibility defaults, API, privacy choices,
and assessment evidence are documented in
[docs/dosette-operations.md](docs/dosette-operations.md).

## Notification Centre

Managers can assign operational notifications while recipients follow an
audited read, acknowledge, and resolve lifecycle. Visibility rules, transitions,
API endpoints, dashboard integration, and assessment evidence are documented in
[docs/notifications.md](docs/notifications.md).

## Stock Intelligence

Managers and Stock Assistants can configure medication minimum levels, reorder
thresholds, and target weeks of cover. The system combines these controls with
active dosette demand and usable, non-expired stock to identify shortages,
excess, inactive, and dead-stock review candidates. The explainable calculation,
API compatibility, role boundary, and demonstration flow are documented in
[docs/stock-intelligence.md](docs/stock-intelligence.md).

## Supplier and Draft Ordering

Managers and Stock Assistants can maintain an original local supplier
directory, assign preferred suppliers to medications, and convert outstanding
stock recommendations into internal draft purchase orders. Open drafts reduce
subsequent suggestions to avoid duplicate planning. Nothing is transmitted to
an external wholesaler or NHS service. The workflow and evidence are documented
in [docs/supplier-ordering.md](docs/supplier-ordering.md).

## Reports and Exports

Authenticated staff can generate role-aware CSV reports for picking lists,
stock, expiry alerts, forecasts, audit history, and notifications. Each export
is audited with a safe summary and avoids proprietary templates or external NHS
services. The reporting scope, endpoints, safety rules, and assessment value
are documented in [docs/reports.md](docs/reports.md).

## Pharmacy Operations

The bounded operations module adds internal task assignment with a guarded
claim, start, complete, and cancel lifecycle, plus validated pharmacy opening
hours. Task visibility is scoped by assignment and role, and lifecycle changes
are audited without copying task content into audit summaries. The responsive
Operations workspace exposes the same guarded workflow with accessible
feedback, filters, and manager-only configuration. The API, permissions,
validation, and assessment evidence are documented in
[docs/pharmacy-operations.md](docs/pharmacy-operations.md).
