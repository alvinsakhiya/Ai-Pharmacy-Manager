# Pharmacy Operations

## Scope

The operations module provides original local workflow support. This first
increment includes:

- operational task assignment and lifecycle;
- pharmacy opening-hours configuration;
- local delivery tracking;
- immutable fridge temperature monitoring;
- local operational appointments;
- curated internal resource links.

It does not send data to delivery providers, booking platforms, wholesalers, or
public healthcare services.

## Operational Tasks

Task fields include title, description, category, priority, assignment, due
time, status, creator, completion time, and cancellation reason.

Lifecycle:

1. A Manager creates a task, optionally assigning it.
2. Authorised operational staff can claim a visible unassigned task.
3. The assigned staff member starts the task.
4. An in-progress task can be completed.
5. A Manager can cancel an open task with a mandatory reason.

Managers see all tasks. Other authenticated roles see tasks assigned to them
and unassigned team tasks. Read-only Users can observe but cannot claim or
change lifecycle state. Tasks assigned to a deleted account do not become
general team tasks because the username snapshot remains populated.

Task create, update, lifecycle, cancellation, and deletion actions are written
to immutable audit history. Audit summaries contain record identifiers, status,
and changed field names only; task titles and descriptions are not copied into
audit text.

## Opening Hours

Opening hours use one unique record for each weekday. An open day requires both
times and a closing time after the opening time. A closed day clears both time
fields.

All authenticated roles can read opening hours. Only Managers can create,
update, or delete the configuration.

## React Workspace

The `/operations` workspace combines:

- summary metrics for open, in-progress, critical, overdue, and completed work;
- manager-only task creation and opening-hours controls;
- guarded claim, start, complete, and cancel actions;
- search and status, category, and priority filters;
- a desktop task table and mobile task cards;
- accessible labels, visible status text, loading states, empty states, errors,
  and action feedback.

Navigation and action controls follow the authenticated user's pharmacy role.
The backend remains authoritative, so hiding a control in React is a usability
improvement rather than the security boundary.

## Local Deliveries

Local delivery records reference an existing patient and store patient and
staff display snapshots for historical context. No address lookup, route
optimisation, courier integration, NHS identifier, or external transmission is
included.

Lifecycle:

1. A Manager or Pharmacist schedules a delivery.
2. A patient-care staff member claims an unassigned record.
3. The assigned staff member marks it ready.
4. A ready, assigned delivery is marked out for delivery.
5. It is completed or marked failed with a mandatory reason.
6. A Manager or Pharmacist can cancel unfinished work with a reason.

Delivery access is limited to patient-care roles. Read-only Users can view
records but cannot change them. Stock Assistants cannot access patient delivery
data. Finished records are read-only, transitions use database locks, and audit
summaries omit patient names, instructions, and outcome details.

The `/deliveries` React workspace provides:

- patient and authorised staff selection for Managers and Pharmacists;
- summary metrics for planned, ready, active, overdue, and completed work;
- claim, ready, dispatch, delivered, failed, and cancelled controls;
- mandatory failure and cancellation reason forms;
- search and assignment/status filters;
- a desktop delivery register and responsive mobile cards;
- role-aware navigation, loading, empty, error, and action feedback states.

Status is communicated with text, icons, and structure rather than colour
alone. The UI does not request or display delivery addresses, maps, routes, or
external provider information.

## Fridge Temperature Monitoring

Temperature logs are append-only, server-timestamped operational records. The
module presents the commonly used 2-8 C operating range for local pharmacy
fridge checks. Any reading outside that range requires a corrective-action
statement before it can be stored.

Managers, Pharmacists, and Stock Assistants can record readings. All
authenticated roles can view the history, while normal API and UI workflows do
not permit edits or deletion. Audit summaries record that a log was created
without copying the temperature, notes, or corrective-action text.

This is a manual local monitoring aid. It does not connect to fridge hardware,
alarm services, manufacturers, wholesalers, NHS services, or clinical decision
support.

The `/fridge-monitoring` workspace adds current-status metrics, an explicit
range explanation, conditional corrective-action validation, date and range
filters, a desktop register, and mobile safety cards. Readings use text, icons,
and structure as well as colour, and the interface offers no edit or delete
controls.

## Operational Appointments

Appointments provide a local planning diary for pharmacy work. Records contain
a title, type, optional patient, start/end time, assigned staff member, notes,
status, and outcome. Patient and staff display snapshots preserve historical
context if linked accounts or records are later removed.

Patient and dosette review types require a patient. New appointments cannot
start in the past, end times must follow start times, and assignments are
limited to patient-care staff. Managers and Pharmacists schedule and cancel
appointments; an assigned Dispenser can complete their appointment. Completed
or cancelled records are read-only.

This module does not connect to calendars, booking providers, SMS/email
services, NHS services, or live clinical systems. Audit summaries omit titles,
patient names, notes, and outcomes.

The `/appointments` workspace provides next-appointment context, today,
upcoming, overdue, and completed metrics, patient-aware scheduling, assigned
completion, cancellation reasons, search and type/status filters, a desktop
register, and responsive mobile agenda cards.

## Internal Resources

Managers can curate titled HTTPS links with descriptions, categories, ordering,
and active status. All authenticated staff can read active links; inactive
entries remain visible only to Managers. URLs with embedded credentials or
non-HTTPS schemes are rejected.

The directory stores links only. It does not upload documents, copy vendor
assets, store secrets, bypass access controls, or connect to NHS services.

## API

Task endpoints:

- `GET/POST /api/operational-tasks/`
- `GET/PATCH/DELETE /api/operational-tasks/{id}/`
- `GET /api/operational-tasks/summary/`
- `GET /api/operational-tasks/assignees/`
- `POST /api/operational-tasks/{id}/claim/`
- `POST /api/operational-tasks/{id}/start/`
- `POST /api/operational-tasks/{id}/complete/`
- `POST /api/operational-tasks/{id}/cancel/`

Task filters include `status`, `priority`, `category`, `assigned`, and `search`.

Opening-hours endpoints:

- `GET/POST /api/opening-hours/`
- `GET/PATCH/DELETE /api/opening-hours/{id}/`

Local-delivery endpoints:

- `GET/POST /api/local-deliveries/`
- `GET/PATCH /api/local-deliveries/{id}/`
- `GET /api/local-deliveries/summary/`
- `GET /api/local-deliveries/assignees/`
- `POST /api/local-deliveries/{id}/claim/`
- `POST /api/local-deliveries/{id}/ready/`
- `POST /api/local-deliveries/{id}/dispatch/`
- `POST /api/local-deliveries/{id}/deliver/`
- `POST /api/local-deliveries/{id}/fail/`
- `POST /api/local-deliveries/{id}/cancel/`

Delivery filters include `status`, `assigned`, `patient`, `date_from`,
`date_to`, and `search`.

Fridge-monitoring endpoints:

- `GET/POST /api/fridge-temperature-logs/`
- `GET /api/fridge-temperature-logs/{id}/`
- `GET /api/fridge-temperature-logs/summary/`

Fridge filters include `range_status`, `date_from`, and `date_to`.

Operational-appointment endpoints:

- `GET/POST /api/operational-appointments/`
- `GET/PATCH /api/operational-appointments/{id}/`
- `GET /api/operational-appointments/summary/`
- `GET /api/operational-appointments/assignees/`
- `POST /api/operational-appointments/{id}/complete/`
- `POST /api/operational-appointments/{id}/cancel/`

Appointment filters include `status`, `appointment_type`, `assigned`,
`patient`, `date_from`, `date_to`, and `search`.

Internal-resource endpoints:

- `GET/POST /api/internal-resources/`
- `GET/PATCH/DELETE /api/internal-resources/{id}/`

Resource filters include `category` and `search`.

## Assessment Value

For AT3, the task lifecycle demonstrates clear internal accountability: create,
claim, start, complete, and review the audit event. Opening hours demonstrate
validated configuration and role-aware administration. Local delivery
tracking demonstrates an original, non-NHS operational workflow with visible
status progression and failure handling. Fridge monitoring demonstrates
append-only safety evidence and visible corrective-action validation.
Operational appointments demonstrate validated local scheduling and
role-owned outcome recording. Internal resources demonstrate safe URL
validation and least-privilege content curation.

For AT4, the bounded Django app, service-layer transitions, transaction locks,
visibility scoping, validation, audit assertions, authentication tests, and
role tests provide evidence for maintainability, security, privacy-aware
design, and workflow integrity.
