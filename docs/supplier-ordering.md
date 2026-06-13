# Supplier and Draft Ordering Workflow

## Scope

This module is an original local planning workflow. It does not connect to a
wholesaler, submit a real order, store supplier credentials, or implement NHS
prescription or reimbursement services.

Managers and Stock Assistants can:

- maintain an active or inactive supplier directory;
- assign one preferred supplier to a medication;
- review outstanding quantities produced by stock intelligence;
- group supplier-ready recommendations into an internal draft;
- mark a draft as reviewed or archive it.

Historical `StockBatch.supplier` text remains unchanged because it records the
supplier description captured when that batch was received. The structured
supplier directory supports future planning without rewriting old provenance.

## Recommendation Reuse

The ordering workflow does not introduce another forecasting algorithm.
`GET /api/draft-purchase-orders/suggestions/` reuses the existing forecast and
stock-intelligence calculation:

1. only positive, non-expired stock contributes to availability;
2. active validated dosette doses determine weekly demand;
3. medication minimum, reorder, and target-cover controls determine the
   recommended quantity;
4. quantities already present in Draft or Reviewed internal orders are
   deducted;
5. a line appears only when an outstanding quantity remains.

This keeps forecasting, stock intelligence, and ordering recommendations
consistent and explainable.

## Data and Statuses

`Supplier` stores local contact, account reference, lead-time, notes, and active
status. It deliberately stores no passwords, API keys, licences, or external
connection configuration.

`DraftPurchaseOrder` statuses are:

- `DRAFT`: generated and awaiting internal review;
- `REVIEWED`: checked internally but not transmitted;
- `ARCHIVED`: closed and read-only.

Each draft item snapshots the medication name, current stock, target stock,
recommended quantity, final draft quantity, and rationale. This preserves the
reason for the recommendation even if stock later changes.

## APIs

- `GET/POST/PATCH /api/suppliers/`
- `GET /api/draft-purchase-orders/`
- `PATCH /api/draft-purchase-orders/{id}/`
- `GET /api/draft-purchase-orders/suggestions/`
- `POST /api/draft-purchase-orders/create-from-suggestions/`

Supplier deletion and draft deletion are not available through the normal API.
Inactive suppliers cannot receive new drafts. Archived drafts are read-only.
All endpoints require a Manager or Stock Assistant role, and create/update
actions are recorded in immutable audit history.

## Demonstration Flow

1. Open **Suppliers & Drafts** as a Manager or Stock Assistant.
2. Add a supplier with a local planning lead time.
3. Assign it to a medication that needs supplier attention.
4. Show the recommendation moving into the supplier-ready group.
5. Create an internal draft and show the outstanding suggestion disappear.
6. Mark the draft reviewed, then explain that no external submission exists.
7. Archive the draft and show the stock recommendation becomes available for a
   future planning cycle.

For AT4, the models, migration, role tests, mismatch validation, duplicate
suppression, audit assertions, and archived-record protection provide evidence
of traceability, consistency, security, and regression testing.
