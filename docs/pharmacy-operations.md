# Pharmacy Operations

## Scope

The operations module provides original local workflow support. This first
increment includes:

- operational task assignment and lifecycle;
- pharmacy opening-hours configuration.

It does not send data to delivery providers, booking platforms, wholesalers, or
public healthcare services. Later increments can add local delivery,
appointment, fridge-monitoring, and internal-resource workflows within the same
bounded app.

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

## Assessment Value

For AT3, the task lifecycle demonstrates clear internal accountability: create,
claim, start, complete, and review the audit event. Opening hours demonstrate
validated configuration and role-aware administration.

For AT4, the bounded Django app, service-layer transitions, transaction locks,
visibility scoping, validation, audit assertions, authentication tests, and
role tests provide evidence for maintainability, security, and workflow
integrity.
