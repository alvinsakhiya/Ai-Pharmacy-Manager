# Structured Clinical Reviews

The clinical review module provides an original, local workflow for recording
patient review notes. It does not connect to NHS services and does not diagnose,
prescribe, recommend treatment, or use proprietary clinical decision logic.

## Data Boundary

`Patient.notes` remains a general profile field for non-structured context.
Structured clinical reviews are stored separately so each record has:

- a patient;
- its original author and an author-name snapshot;
- a review category;
- the review text;
- an optional review or follow-up date;
- an explicit follow-up status; and
- created and updated timestamps.

The supported categories are general review, dosette review, medication concern,
stock-related note, and follow-up required. Follow-up can be not required,
required, in progress, or completed.

## Access and Traceability

Only Managers and Pharmacists can read or change clinical reviews. The React
navigation reflects this rule, while Django REST Framework enforces it for
every request.

Creation and updates write an audit event containing only the record identifier
and changed field names. Clinical note contents are deliberately excluded from
audit summaries. Updating a record does not replace its original author.

## API

The authenticated endpoint is `/api/clinical-reviews/`.

It supports normal REST create, list, retrieve, update, and delete operations.
List responses are paginated and can be filtered using:

- `patient`
- `category`
- `follow_up_status`
- `search`

Search covers the patient's name, review text, and stored author name. Invalid
filter codes return HTTP `400` rather than silently producing misleading
results.

## Demonstration Scope

For an AT3 demonstration, a Pharmacist can create a structured review, assign a
follow-up date, update its status, and then show the corresponding safe audit
event as a Manager. AT4 can use the permission, validation, audit-redaction, and
API tests as evidence of security, traceability, and separation of concerns.
