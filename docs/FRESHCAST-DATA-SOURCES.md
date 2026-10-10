# FreshCast data sources and connected kitchen planning

The orders, menus, recipes and inventory in Dapur Kita are persistent database
records. "Demo/test" describes their origin, not their storage: the owner
confirmed that the existing orders are fictional customer transactions. That
does not mean the application generates random orders when rendering a page.

There are distinct planning paths:

| Path | Demand source | Recipes and stock |
| --- | --- | --- |
| FreshCast Genpact mode (`source=live`) / five predictive APIs | Saved CatBoost model trained on external Genpact weekly center/meal history | Explicit simulated CSV operations |
| Existing `/api/admin/planning/` / kitchen Planner | Existing database orders and accepted recipe snapshots; paid booking-history estimate shown separately | Database `RawMaterial` / `InventoryItem` batches |
| FreshCast default My kitchen mode / `/api/admin/predictive/local-plan/` | Paid pending/processing orders with reviewed dated preparation; no prediction of additional bookings | Accepted recipe snapshots and database batches, with native-unit conversion |
| `/api/admin/predictive/local-scenario/` | The same confirmed orders, no changed customer demand | The same database snapshot plus one explicitly hypothetical purchase |

The kitchen Planner excludes expired, not-yet-received and quarantined stock,
allocates by expiry date, and produces shopping quantities for reviewed order
requirements. Already-deducted orders are skipped. Orders with changed recipes
whose preparation plans still need review are also skipped until their plans are
confirmed; it must not imply those meals have been cooked or scheduled.

**My kitchen mode is connected to database orders and stock.** Refresh after
changing an order, its accepted recipe/preparation plan or a stock batch. The
source is `DATABASE`; the comparator labels the extra purchase as hypothetical.
The Genpact mode remains separate: its operations are `SIMULATED`, so database
stock changes do not alter its CSV calculations. See the
[integrated kitchen mode](LOCAL-KITCHEN-INTEGRATION.md).

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

An [offline aggregate booking experiment](LOCAL-BOOKING-EXPERIMENT.md) has now
trained CatBoost on the database export's creation-date counts. Its target is
gross recorded booking intent, including eventually cancelled/unpaid orders.
It cannot produce menu-specific ingredient needs, and it did not outperform
the four-week-average baseline. It is not deployed in either mode.

Both excess expiry stock and shortages are relevant. In the local plan,
shortfall is required quantity minus FEFO allocations: stock expiring before
preparation finishes cannot cover that requirement. No safety-stock policy or
supplier lead times are assumed. The Genpact example separately includes
explicit simulated safety stock. Neither a forecast nor a calculation proves that
stock was purchased, consumed or wasted. Dates, units and supplier lead times
must be recorded before giving reliable purchasing deadlines. No inventory was
created or changed by planning or scenario API calls. A separate explicit
fictional-demo preparation script can create a labelled normal checkout order
and assumed batches through staff APIs; those records are not customer evidence
or model training data.
