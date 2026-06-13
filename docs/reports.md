# Reporting and Export Centre

## Scope

The reporting module provides original CSV exports for local operational review
and university evidence. It does not copy vendor report templates, branding, or
proprietary layouts, and it does not connect to NHS or wholesaler services.

Current exports:

- patient-specific picking list;
- stock report;
- expiry safety report;
- forecast report;
- audit report;
- notification report.

CSV was selected first because it is simple, transparent, spreadsheet-ready,
and deployment-safe on Vercel, Railway, and Render without adding a PDF
rendering dependency. Browser print-to-PDF or a future dedicated PDF renderer
can be added later if the project needs polished printable packs.

## Safety Rules

All report endpoints require JWT authentication and reuse existing role
boundaries:

- picking-list export follows picking-list permissions;
- stock export follows inventory read permissions;
- expiry export follows expiry-alert permissions;
- forecast export follows forecast permissions;
- audit export is Manager-only;
- notification export is available to authenticated roles but preserves the
  same row visibility as the notification centre.

Each successful export creates an immutable `ReportExport` audit event. Audit
summaries include report type and row count only. They deliberately avoid
patient names, notification messages, medication instructions, passwords, and
tokens.

The notification CSV excludes message bodies to reduce unnecessary free-text
exposure. Full notification details remain available in the authenticated
notification centre.

## API Endpoints

- `GET /api/reports/picking-list/{patient_id}.csv`
- `GET /api/reports/stock.csv`
- `GET /api/reports/expiry.csv`
- `GET /api/reports/forecast.csv`
- `GET /api/reports/audit.csv`
- `GET /api/reports/notifications.csv`

Exports are standard `text/csv` responses with an attachment filename. They
preserve existing business logic: picking uses validated dose totals and FEFO
allocation, forecasting uses usable non-expired stock, and expiry reports still
include expired stock for safety monitoring.

## Demonstration Value

For AT3, the Reports page gives a clear way to show professional evidence
generation: select a patient, download a picking list, export stock or forecast
data, then show the audit history proving the export was recorded.

For AT4, the feature supports evaluation evidence for authentication,
role-based access, traceability, safety-aware forecasting, FEFO behaviour, and
deployment-friendly design.
