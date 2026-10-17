# Kitchen forecast and preparation readiness

## Preparation warnings

The planner's `setup_menus` list contains only active menus with no detailed preparation tasks. Archived grocery products and paused menus are not active-menu setup failures. The preparation-review link initially filters to active menus missing steps; turn off its checkbox to inspect existing steps. Archived products remain available through the selling-status filter, and their historical order references are retained.

The owner verified 24 active kitchen menus already had preparation tasks; the apparent 18 missing menus were old archived products. No invented cooking steps are added to those grocery records.

Orders with no task plan are grouped by their next action instead of reporting all records as ready for scheduling:

| Record state | Planner action |
| --- | --- |
| Pending, undeducted stock, valid future delivery, no confirmed task plan | Preparation review |
| Missing or invalid delivery date | Resolve delivery records in Orders |
| Delivery time already passed | Confirm outcome or arrange a new delivery |
| Preparation started or stock deducted | Review existing records; do not silently restart preparation |
| Confirmed detailed plan or saved manual reservation | Already planned; not a missing-plan count |

This presentation does not alter dates, payment status, completed history, preparation reservations or stock. Old unresolved orders remain accessible. A manually confirmed overall window is a reservation, not proof that individual recipe steps were validated. Exact unresolved live counts require a refreshed API response; the cloud workspace did not independently read the owner's database.

## Existing kitchen forecasting workflow

Use **FreshCast → My kitchen** (`/admin/ai/decisions?source=local`) for the connected decision assistant. The existing `local-decisions/` API reads this application's kitchen records and computes per-active-menu forecasts. It does not require Genpact files, IDs, a Genpact artifact or a manually run training job.

1. Eligible historical **paid, delivered** portions are grouped by local delivery day for each active menu. Recorded `delivery_at` takes precedence over order creation. A missing delivery date uses an explicitly estimated creation-date fallback; confidence is limited and no delivery commitment is reconstructed. Historical renamed menus are excluded from per-menu demand.
2. The existing algorithm starts with a 28-day moving average. With at least 42 daily observations, it compares 28-day mean, 7-day mean and same-weekday baselines using chronological training, 14-day validation and a separate 14-day test. Validation chooses the method; test targets do not select it. Missing recording days are treated as zero recorded sales, not verified zero demand. Evaluation availability alone does not establish reliable coverage.
3. Forecast portions are mapped through current active-menu recipes into additional ingredient needs. Existing booked portions are subtracted to avoid counting them twice. Confirmed-order requirements independently use accepted order recipes, reviewed preparation dates and stock-planning eligibility.
4. Dated inventory batches are projected in expiry order, respecting receipt and expiry dates. The assistant separates confirmed shortages, forecast-sensitive surplus, and evidence needing review. It links actions to the existing inventory, menu and planner pages.
5. Purchasing and marketing scenarios remain advisory. Hypothetical financial assumptions or promotion responses are not actual sales or causal model outputs. No forecast endpoint changes payments, purchases, stock or customer orders.

Historical cooking task plans are **not** training features or sales-eligibility requirements. Upcoming preparation is an operational capacity requirement, not evidence of completed sales. Paying an upcoming order does not make it historical training data.

## Website-wide comparison

`local-forecast/` separately aggregates all eligible website products by completed Monday–Sunday delivery week, including archived products in historic orders. It compares moving average, last week and ridge autoregression when at least 14 completed weeks permit the chronological split. Shorter histories return a labeled baseline rather than claiming a fitted, evaluated model.

The forecast page now displays that API's selected forecast and method directly. Its full-week forecast already includes expected confirmed demand; do not add bookings again. Use the per-active-menu decision assistant for kitchen recipe and expiry decisions, rather than interpreting an aggregate website forecast as a particular dish or ingredient quantity.

The optional existing `train_kitchen_forecast --output PATH` command exports this aggregate evaluation/model report; it does not fix orders or train on Genpact. No new model, fabricated sales expansion or production training run was introduced in this batch. Owner-confirmed fictional database records remain demonstration evidence, and cannot establish accuracy on real customer demand.

## Deployment and validation

Both frontend and Django changes must deploy together for the active-only setup warning to change. Pushing a commit is not confirmation of a successful Vercel deployment. The intended deployment uses the owner's existing PostgreSQL schema `django_app`; a missing schema setting can point the process at empty/default tables. Do not run migrations merely to hide a schema mismatch.

Regression checks cover archived/paused menus, preservation of older orders, future versus overdue/missing-date setup groups, and delivery-based menu forecasts feeding ingredient expiry projections even with no historical preparation tasks. All automated fixture data is isolated test data; fixture performance is not a live model evaluation result.
