# Stock Governance

Stock quantities are controlled through an append-only movement ledger. This
keeps the current balance explainable without changing the existing FEFO,
expiry-alert, picking-list, or forecasting calculations.

## Movement Types

| Movement | Direction | Purpose |
| --- | --- | --- |
| Received | Positive | New stock received into an existing or newly created batch |
| Adjustment | Positive or negative | Confirmed operational stock adjustment |
| Picking allocation | Negative | Explicitly committed stock allocation |
| Correction | Positive or negative | Correction of an identified recording error |
| Waste / quarantine | Negative | Stock removed from usable inventory |

Every movement requires a non-zero signed quantity and a reason. The
transaction is rejected if it would create a negative batch balance. Expired
stock cannot be recorded as a picking allocation.

## Picking Workflow

The existing patient picking-list endpoint remains a recommendation tool. It
calculates FEFO allocation and shortfalls but does not silently decrement stock.
This preserves repeatable picking-list generation and makes stock consumption
an explicit, auditable action.

## API

Managers and Stock Assistants can record a controlled movement:

```text
POST /api/stock-batches/{batch_id}/adjust/
```

Example body:

```json
{
  "movement_type": "CORRECTION",
  "quantity_change": -5,
  "reason": "Physical stock count correction"
}
```

Movement history is read-only:

```text
GET /api/stock-movements/
GET /api/stock-movements/?movement_type=CORRECTION
GET /api/stock-movements/?stock_batch=12
GET /api/stock-movements/?search=physical
```

Direct quantity changes through `PATCH /api/stock-batches/{id}/` are rejected.
Other permitted batch metadata updates continue to use the existing endpoint.

## Migration

Run `python manage.py migrate` during deployment. Existing positive batch
balances receive a system-generated opening `Received` movement so the new
ledger starts from the quantity already held.

Movement entries cannot be edited or deleted through the model, API, or Django
Admin. Direct database administrators still retain database-level authority,
which should be controlled through deployment access policies and backups.
