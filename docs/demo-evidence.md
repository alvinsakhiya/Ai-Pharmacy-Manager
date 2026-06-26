# Demo Evidence Pack

## Project Summary

This project is an AI-enhanced pharmacy stock optimisation and patient
Dosette/MDS management prototype for operational pharmacy workflow support.
It supports stock review, Dosette preparation workflow, role-scoped patient
records, pharmacist review records, reports, alerts, and work queue triage.

The system highlights operational signals and decision-support estimates.
Human review is required before ordering, transfer, Dosette stock deduction,
or workflow status changes.

This evidence pack does not claim NHS integration, clinical diagnosis,
guaranteed forecasting, automatic ordering, automatic transfer, automatic cycle
creation, compliance proof, or production readiness.

## Demo Users

Seed demo data provides fictional local accounts with the shared demo-only
password `DemoPass!2026`.

| User | Role | Scope |
| --- | --- | --- |
| [admin@demo.local](mailto:admin@demo.local) | Admin | Global/admin |
| [superintendent@demo.local](mailto:superintendent@demo.local) | Superintendent | JMW Pharmacy Group |
| [pharmacist@demo.local](mailto:pharmacist@demo.local) | Pharmacist | JMW Sutton |
| [dispenser@demo.local](mailto:dispenser@demo.local) | Dispenser | JMW Croydon |
| [stock@demo.local](mailto:stock@demo.local) | Stock Employee | JMW Sutton and JMW Croydon stock scope |

## Completed Capability Evidence

| Capability | Evidence areas |
| --- | --- |
| Authentication and RBAC | `backend/apps/accounts`, `backend/apps/tenancy`, protected frontend routes |
| Multi-pharmacy and tenant scoping | `backend/apps/tenancy`, scoped managers, demo group/pharmacy seed data |
| Audit logging | `backend/apps/audit`, audit log UI, append-only application-level events |
| Patient records and Patient ID generation | `backend/apps/patients`, patient UI, generated pseudonymous references |
| Dosette/MDS medication workflow | `backend/apps/blister`, patient Dosette workspace, medication lines, cycles |
| Medication catalogue and local enablement | `backend/apps/catalogue`, catalogue UI, local medication records |
| dm+d JSON import foundation | `docs/catalogue-import.md`, catalogue import command and tests |
| Inventory receiving, batches, expiry, adjustments, and counts | `backend/apps/inventory`, inventory list/detail, batch movement history |
| Forecast and reorder suggestions | `backend/apps/analytics`, Stock Intelligence, forecast explanations |
| Transfer suggestions | `backend/apps/analytics`, superintendent/admin transfer suggestion flow |
| Reports and CSV exports | `backend/apps/reports`, reports dashboard, CSV export buttons |
| Alerts/System signals | `backend/apps/notifications`, Alerts page, notification centre |
| Work Queue | `backend/apps/notifications/work_queue.py`, Work Queue screen |
| Pharmacist Reviews | `backend/apps/reviews`, reviews queue and patient review section |
| Accessibility/settings | Settings screen accessibility preferences and frontend tests |

## Demo Flow

1. Log in as `pharmacist@demo.local`.
2. Open the dashboard and review the Needs attention widget.
3. Open Work Queue and review operational tasks.
4. Open a Dosette task from Work Queue.
5. View the patient workspace.
6. Confirm Patient ID is shown instead of patient PII in operational summaries.
7. Open Dosette/MDS.
8. View medication lines, cycle details, stock preview, and FEFO-style batch
   suggestions.
9. Print or preview the Dosette/MDS carer sheet.
10. Open Inventory.
11. Receive stock from the catalogue only on disposable/resettable demo data.
12. Review expiry, dead-stock, forecast reorder, transfer suggestion, and CSV
    report sections.
13. Open Alerts and confirm they are system signals, not task completion.
14. Open Pharmacist Reviews.
15. Log in as `stock@demo.local` and show stock, reports, alerts, and analytics
    without patient-specific data.
16. Log in as `superintendent@demo.local` or `admin@demo.local` and show the
    cross-pharmacy operational overview.

## Safety Boundaries

- Human review is required for suggestions and workflow actions.
- Forecasts are estimates based on available stock movement history.
- Reorder suggestions are review prompts, not purchase instructions.
- Transfer suggestions are potential opportunities, not transfer commands.
- Work Queue items are operational tasks and do not complete themselves.
- Alerts are risk/system signals and do not perform actions.
- The system does not automatically order stock.
- The system does not automatically transfer stock.
- The system does not automatically create Dosette/MDS cycles.
- The system does not integrate with NHS systems.
- The system does not provide diagnosis or clinical recommendations.
- The system does not claim regulatory, clinical, GDPR, or compliance proof.
- Patient PII is restricted to patient-scoped views.
- Stock, reports, work queue, alerts, and analytics avoid patient names, DOB,
  postcode, phone, email, address, and NHS number.

## Final Safety Audit Notes

| Area | Audit finding |
| --- | --- |
| Stock analytics | Stock Intelligence uses stock items, batches, movements, pharmacy scope, and operational explanations. It does not query or return patient PII. |
| Forecasting | Forecast output includes confidence, history points, forecast estimates, and human-review wording before ordering. |
| Transfer suggestions | Suggestions include source/destination pharmacy, stock quantities, confidence, and human-review wording before transfer. |
| Reports | Stock reports are stock/pharmacy scoped. MDS workload reports aggregate cycle status by pharmacy and avoid patient names. |
| Alerts | Stock alerts contain medication, pharmacy, severity, category, and subject stock item. Dosette alerts use cycle reference and Patient ID only. |
| Work Queue | Patient-related tasks use pseudonymous Patient ID/reference, existing-record links, and review-before-action wording. |
| Reviews | Review records are permission-gated and operational workflow records, not clinical recommendations. |
| Catalogue | Medication catalogue access is permission-gated and supports prepared JSON import foundation only. |
| Audit log | Audit metadata is designed to remain PII-free and operational. |

## RBAC Evidence

| Role | Can see | Restricted from |
| --- | --- | --- |
| Admin | Global operational/admin areas, users, organisation, catalogue, inventory, reports, alerts, work queue, patient areas, reviews, audit | No safety override for clinical/NHS claims; demo data only |
| Superintendent | Group-level stock, inventory, analytics, transfer suggestions, reports, alerts, audit, catalogue management | Patient/MDS patient-specific modules and patient PII |
| Pharmacist | Scoped patients, Dosette/MDS, reviews, stock, inventory, analytics, reports, alerts, work queue, limited user management | Cross-tenant data and actions outside assigned scope |
| Dispenser | Scoped patient/Dosette read and workflow areas, stock receiving/view, reviews view, reports/alerts/work queue as permitted | Manage-only controls such as patient management, review management, stock transfer, and catalogue management |
| Stock Employee | Scoped stock, inventory, receiving/transfer/count/adjustment flows as permitted, Stock Intelligence, stock reports, alerts | Patient modules, patient PII, Dosette patient workspace, reviews, audit/admin areas |

## Test Evidence

Backend checks:

```bash
docker compose exec backend ruff check .
docker compose exec backend ruff format --check .
docker compose exec backend mypy .
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend pytest
```

Frontend checks:

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
docker compose exec frontend npm run test
```

## Known Non-Functional Notes

- Demo data is fictional and local only.
- dm+d import currently supports a prepared JSON import foundation, not a full
  TRUD XML pipeline.
- Forecast and transfer outputs are operational decision support only.
- No live NHS integration is implemented.
- No live email, SMS, push notification, or external messaging delivery is
  implemented.
- This prototype is not production-ready and does not claim certification.
