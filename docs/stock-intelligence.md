# Stock Intelligence

## Purpose

Stock intelligence turns the existing explainable demand forecast into an
operational stock-control view. It does not use external ordering services or
proprietary algorithms.

Each medication can define:

- `minimum_stock_level`: the safety floor. Falling below it is high risk.
- `reorder_threshold`: the point at which replenishment should begin. It must
  be equal to or higher than the minimum.
- `target_weeks_of_cover`: the desired number of weeks supported by current
  active dosette demand, from 1 to 52 weeks.

Existing medication records receive conservative defaults of zero units for
the two stock levels and four target weeks during migration.

## Explainable Calculation

Only positive-quantity, non-expired batches count as available stock. Weekly
demand continues to come from validated active dosette schedules.

For medications with demand, target stock is the greatest of:

1. minimum stock level;
2. reorder threshold; and
3. weekly demand multiplied by target weeks of cover, rounded up.

The recommendation reports the number of units needed to reach that target.
Stock is classified as out of stock, critically short, below minimum, at the
reorder threshold, low cover, below target, adequate, or excess.

For medications without active demand:

- zero available stock is reported as no active demand;
- recent available stock is reported as inactive;
- available stock whose latest receipt is at least 180 days old is marked for
  dead-stock review.

These are operational review prompts, not clinical decisions.

## APIs and Compatibility

- `GET /api/stock-intelligence/` returns summary counts and medication items.
- `PATCH /api/medications/{id}/` updates the three stock-control fields.
- `GET /api/forecasts/` keeps its original six response fields and adds
  compatible stock-control details for richer clients.

The stock-intelligence endpoint is available only to Managers and Stock
Assistants. Medication updates remain protected by the existing inventory role
permission. Successful stock-intelligence access and threshold updates are
written to the immutable audit history.

## Demonstration Flow

1. Sign in as a Manager or Stock Assistant.
2. Open **Stock Intelligence** from the navigation or Inventory page.
3. Filter the view to low, excess, inactive, or dead stock.
4. Select **Configure**, set a minimum, reorder threshold, and target cover.
5. Save and show the recalculated target, recommended quantity, and status.
6. Open Audit History as a Manager to show the access and medication update.

For AT4, the migration, validation tests, three-query prefetch test, role tests,
and classification tests provide evidence of correctness, performance
awareness, authorization, and regression protection.
