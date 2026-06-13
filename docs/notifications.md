# Notification Centre

The notification centre is an original local coordination workflow. It does not
connect to NHS systems or external messaging services.

## Visibility

Managers can view and manage every notification. Other authenticated pharmacy
roles can view:

- notifications assigned to their own account; and
- general notices that were deliberately created without an assignee.

If an assigned staff account is later deleted, the saved username remains for
traceability and the notification does not become visible as a general notice.

## Lifecycle

Managers create notification content and choose its priority, recipient, due
date, expiry date, and optional related-record reference. A named recipient or
Manager can then progress it through:

1. `New`
2. `Read`
3. `Acknowledged`
4. `Resolved`

A notification must be acknowledged before resolution. Resolution requires a
reason and records both acknowledged and resolved timestamps. General notices
are read-only for non-Managers.

## Priorities and Safety Signals

Priorities are Low, Medium, High, and Critical. The API also reports whether an
unresolved notification is overdue or past its expiry date. The UI communicates
these states with text, icons, and patterns rather than colour alone.

## API

The authenticated collection is `/api/notifications/`.

List filters:

- `status`
- `priority`
- `assigned` (`me`, `unassigned`, or a positive user id)
- `search`

Lifecycle actions:

- `POST /api/notifications/{id}/mark-read/`
- `POST /api/notifications/{id}/acknowledge/`
- `POST /api/notifications/{id}/resolve/`

The dashboard uses `GET /api/notifications/summary/`. Managers can load active
staff choices from `GET /api/notifications/assignees/`.

Notification audit summaries record the entity identifier and lifecycle status
only. Titles, messages, and resolution reasons are not copied into audit
history.

## Assessment Evidence

AT3 can demonstrate a Manager assigning a critical task, the recipient
acknowledging and resolving it, and the dashboard count updating. AT4 can cite
the recipient-scoped queryset, object-level permissions, row-locked state
transitions, validation, audit-redaction tests, and responsive user interface.
