# Demo Script and Screenshot Checklist

## Purpose

This document provides a practical demonstration path and screenshot checklist
for the final report, video, or live demo. Use fictional seeded data only.

## Prerequisites

Seed demo data:

```bash
cd backend
python manage.py seed_demo
```

Run the backend:

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
```

Run the frontend:

```bash
cd frontend
npm run dev
```

For E2E-style preview evidence, Playwright uses the Vite preview app at
`http://localhost:4173`.

Shared demo-only password: `DemoPass!2026`

| Email | Role | Demo scope |
| --- | --- | --- |
| `admin@demo.local` | ADMIN | Global/admin |
| `superintendent@demo.local` | SUPERINTENDENT | JMW Pharmacy Group |
| `pharmacist@demo.local` | PHARMACIST | JMW Sutton (`SUT`) |
| `dispenser@demo.local` | DISPENSER | JMW Croydon (`CRO`) |
| `stock@demo.local` | STOCK_EMPLOYEE | JMW Sutton and JMW Croydon stock scope |

## Role-by-Role Walkthrough

### Admin

1. Log in as `admin@demo.local`.
2. Show the dashboard and role-based navigation.
3. Open Users and Organisation to show administration areas.
4. Open Medications to show the catalogue.
5. Open Inventory and an inventory detail page.
6. Open Reports to show stock attention and stock movement report sections.
7. Open Audit Log to show operational audit visibility.

### Superintendent

1. Log in as `superintendent@demo.local`.
2. Show group-level dashboard/navigation.
3. Demonstrate relevant governance/organisation visibility where available.
4. Confirm patient modules are not available for this role.
5. Use screenshots to show role-based restrictions without exposing real data.

### Pharmacist

1. Log in as `pharmacist@demo.local`.
2. Open Patients and then the first patient detail page.
3. Open Dosette/MDS from the patient detail page.
4. Show medication lines, cycles, picking list, and stock availability.
5. Prepare a suitable cycle only if the demo database state makes it safe.
6. Demonstrate stock preview/FEFO suggestions.
7. Demonstrate stock deduction only on a disposable demo run where the
   irreversible append-only stock movement is acceptable.
8. Open Reviews or the patient Reviews section.
9. Create a review using a unique demo note marker.
10. Complete the review and show the completed state.
11. Open Alerts to show operational stock and Dosette/MDS alerts.

### Dispenser

1. Log in as `dispenser@demo.local`.
2. Show permitted patient and Dosette/MDS read/workflow areas where available.
3. Confirm restricted management actions are absent where applicable.
4. Avoid changing stock or patient data unless the demonstration plan requires
   it and the demo database can be reset afterwards.

### Stock Employee

1. Log in as `stock@demo.local`.
2. Open Inventory and an inventory detail page.
3. Open Stock Intelligence.
4. Open Reports and show CSV download buttons without needing to inspect file
   contents during the demo.
5. Open Alerts and show stock alert cards.
6. Confirm patient modules are not available for this role.

## Screenshot Checklist

- Login page.
- Dashboard landing page.
- Role-based navigation for at least two roles.
- Inventory list and inventory detail.
- Stock receiving, adjustment, or transfer UI if safe for the demo database.
- Stock Intelligence page.
- Reports page.
- CSV download button.
- Alerts page.
- Patients list.
- Patient detail page.
- Dosette/MDS cycle view.
- Stock preview and FEFO batch suggestions.
- Stock deduction evidence, only on disposable demo data.
- Reviews queue.
- Patient Reviews section.
- Completed review state.
- Audit Log.
- GitHub Actions CI green result.
- Playwright E2E 23/23 green result.
- Tags/releases list showing `module-14-pharmacist-review-workflow-complete`.

## Verification Commands

Backend checks:

```bash
cd backend
ruff check .
ruff format --check .
mypy .
python manage.py makemigrations --check --dry-run
python manage.py check
pytest
```

Frontend checks:

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

## Demo Safety Notes

- Use fictional demo data only.
- Do not enter or display real patient data.
- Do not claim NHS integration.
- Do not describe the system as making clinical decisions.
- Do not claim diagnosis, clinical recommendation, regulatory compliance, or
  production readiness.
- Exported reports are operational stock reports only.
- Stock deduction creates append-only movement history; use a resettable demo
  database when demonstrating it.
