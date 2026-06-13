# Dosette Operational Depth

## Scope

This phase extends the existing dosette workflow with original local operational
metadata:

- patient care-setting grouping: Community, Care home, or Other;
- optional dosette cycle start date;
- validated cycle length from 1 to 52 weeks;
- optional review date;
- immutable medication-schedule change history.

It does not add external patient identifiers, prescription transmission,
clinical decision support, or third-party system integration.

## Backward Compatibility

Existing patient records default to `Community`. Existing dosette records
default to a four-week cycle and retain blank cycle-start and review dates.
Picking lists, FEFO allocation, expiry alerts, and forecasting continue to use
the same active schedule and dose fields.

## Change History

API create, update, activation, deactivation, and deletion actions append a
`DosetteMedicationChange` snapshot. Each snapshot stores:

- stable record, patient, and medication identifiers;
- patient and medication display names;
- dose values and active status;
- cycle start, cycle length, and review date;
- change type and changed field names;
- actor username and timestamp.

Instruction text is not copied into history. A history event records that the
`instructions` field changed without duplicating potentially sensitive
free-text content.

History rows cannot be updated or deleted through the model manager, model
instance, API, or Django Admin. Snapshot identifiers and names remain available
after a dosette schedule is deleted.

## API

- `GET/POST /api/dosette-records/`
- `GET/PATCH/DELETE /api/dosette-records/{id}/`
- `GET /api/dosette-changes/`
- `GET /api/dosette-changes/{id}/`

History filters:

- `patient={id}`
- `dosette_record={id}`
- `change_type=CREATED|UPDATED|ACTIVATED|DEACTIVATED|DELETED`
- `search={patient, medication, or actor text}`

The history endpoint is read-only and uses the existing dosette role
permissions. Managers, Pharmacists, Dispensers, and Read-only Users can review
history; Stock Assistants cannot access patient dosette workflows.

## Assessment Value

For AT3, cycle dates and history provide an understandable patient workflow:
show the current schedule, change a dose or review date, then show the immutable
snapshot with the responsible staff member.

For AT4, the migration defaults, validation, role tests, transaction boundaries,
privacy-conscious snapshot design, and immutability tests provide evidence for
maintainability, traceability, security, and regression protection.
