# FreshCast data sources and the kitchen-stock gap

The orders, menus, recipes and inventory in Dapur Kita are persistent database
records. "Demo/test" describes their origin, not their storage: the owner
confirmed that the existing orders are fictional customer transactions. That
does not mean the application generates random orders when rendering a page.

There are currently two distinct planning paths:

| Path | Demand source | Recipes and stock |
| --- | --- | --- |
| FreshCast's five predictive APIs / Decision Assistant | Saved CatBoost model trained on external Genpact weekly center/meal history | Explicit simulated CSV operations |
| Existing `/api/admin/planning/` / kitchen Planner | Existing database orders and accepted recipe snapshots; paid booking-history estimate shown separately | Database `RawMaterial` / `InventoryItem` batches |

The kitchen Planner excludes expired, not-yet-received and quarantined stock,
allocates by expiry date, and produces shopping quantities for reviewed order
requirements. Already-deducted orders are skipped. Orders with changed recipes
whose preparation plans still need review are also skipped until their plans are
confirmed; it must not imply those meals have been cooked or scheduled.

**The FreshCast Decision Assistant is not currently connected to kitchen stock.**
Its `sources.operational` field remains `SIMULATED`. Saving new stock in Dapur
Kita does not change those CSV calculations. This is a remaining integration
gap, not evidence that the database records are absent.

Genpact `meal_id` is not a Dapur Kita `Product.id`. The model has not learned the
new dishes merely because their names exist in the database. Joining the IDs or
matching generic food names would incorrectly apply an external center's demand
to a different business. No such automatic mapping is implemented.

For database kitchen planning, confirmed preorder quantities can supply known
ingredient needs now, using accepted recipes and correctly converted native
units (`g`, `kg`, `ml`, `l`, `unit`). This is booking-based planning, not a local
CatBoost forecast. It should remain distinct from the Genpact demonstration.
Future local forecasts require usable dated history, chronology-safe features,
baseline evaluation and explicit handling of bookings already counted. See
[the actual local training audit](LOCAL-PREORDER-TRAINING.md).

Both excess expiry stock and shortages are relevant. Shortfall is required
quantity minus eligible stock, floored at zero; replenishment also includes a
verified safety-stock policy. Neither a forecast nor a calculation proves that
stock was purchased, consumed or wasted. Dates, units and supplier lead times
must be recorded before giving reliable purchasing deadlines. No inventory was
created or changed to make these calculations appear complete.
