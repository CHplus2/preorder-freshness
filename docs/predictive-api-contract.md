# Predictive API contract — Dormathon 2026

Version: `1` (implemented). Current integration branch: `integration/dormathon-demo`.
Dashboard branch: `feature/ai-dashboard`.

## Availability and scope

**The five Genpact endpoints, `backtest/`, `local-plan/` and `local-scenario/` are implemented**.
The local plan reads database orders and stock without using a model; its distinct
schema is documented below. The evaluated Genpact CatBoost artifact
achieved 28.23% WAPE versus 34.81% baseline on weeks 136–145. A complete separately
provisioned bundle and optional ML dependencies are required; Git alone does not
supply them. See `backend/predictive_ai/README.md` for reset and deployment steps.
Generated operations currently cover center 13 only; other centers return HTTP
503 `operational_data_unavailable`. No empty/fabricated forecast is substituted.

The forecasting domain is external Genpact **weekly** center/meal demand.
`meal_id` is never a Dapur Kita `Product.id`. Recipe, stock, costs and supplier
inputs initially use explicit simulated operational data. No local FYP stock is
read or modified by those five Genpact endpoints. The separate local plan uses
accepted order recipes and raw-material IDs; it does not map Genpact meals onto
the store's menus.

The separate local preorder readiness audit does not change these endpoints or
their demand source. No local model is exposed by these endpoints; see
[local training preparation](LOCAL-PREORDER-TRAINING.md). Both expiry surplus
and shortage risks are calculated. Explanations include shortfall, illustrative
replenishment and safety stock; no purchase is executed.

Database order storage is distinct from these prediction sources; see
[data-source clarification](FRESHCAST-DATA-SOURCES.md). A separate protected
deployment transfer route `/api/internal/freshcast-bundle/` is not a dashboard
API and cannot access business records. Its bearer credential is server-only;
the existing staff authentication rules below remain unchanged.

A separate [local recorded-booking CatBoost experiment](LOCAL-BOOKING-EXPERIMENT.md)
is trained offline. It predicts aggregate recorded booking volume, not menu
fulfilment or ingredient use, and did not beat the trailing-average baseline.
It is not deployed or compatible with this Genpact response schema. Do not
replace these metrics/source labels with its experimental results.

The separate [public bakery benchmark](PUBLIC-BAKERY-DEMO-FEASIBILITY.md) is also
offline. No bakery forecast/import endpoint is implemented, and its model is not
used by either the Genpact routes or `local-plan/`.

## HTTP rules

Base: `/api/admin/predictive/`; trailing slashes required. JSON UTF-8. All
operations require Django staff permission (`IsAdminUser`) and existing session
authentication. Session-authenticated POST requires CSRF using existing frontend
conventions. Anonymous/nonstaff requests return HTTP 403 under existing DRF
session defaults. GET is read-only; POST scenarios are nonpersistent and cannot
send messages, deduct stock, or create orders.

For Genpact responses, integers are IDs/week indices; floating-point numbers
are forecasts, kg quantities, MYR amounts and percentage metrics. The local
plan uses native material units and calendar dates instead. Unknown costs are
`null`, never zero. All output numbers must be finite. Arrays may be empty only
after a successful calculation. Genpact weekly expiry is an inclusive bucket,
not a calendar date or proof of food safety. Its simulated prices and operational
quantities must not be labelled real shop observations.

## Genpact endpoints

### Labelled held-out replay (implemented)

`GET backtest/?center_id=13&week=136` requires both positive integer parameters;
only weeks 136–145 from the saved artifact's validation metadata are supported.
Unknown, repeated, missing or additional parameters return 400. No observations
for a valid selection return 422 `no_eligible_history`. Missing data/model return
the existing 503 errors. Staff permission is required; POST returns 405;
responses use `Cache-Control: no-store`. No business database records are written.

Success fields: `api_version: "1"`, `mode: "historical_backtest"`, `center_id`,
`week`, `model_status: "ready"`, `training_max_week: 135`,
`evaluation_protocol: "rolling_one_week_ahead"`, `observations` (row count),
`actual_orders_total`, `sources: {demand: "GENPACT_HISTORICAL", operational:
"NOT_USED"}`, `warnings`, `scores`, and `meal_comparisons`.
`scores` contains `catboost` and `previous_observation`; each has
`wape_percent` (number or null when actual total is zero) and
`mae_orders_per_meal` (number). Each comparison has integer `meal_id`, numeric
`actual_orders`, `predicted_orders` and `baseline_orders`.

This replays the already reported holdout, not newly collected independent data.
Only earlier quantities enter shifted features. Recorded target-week prices and
promotion flags are assumed known. The previous-observation baseline may span
missing weeks. Selected scores are not the pooled whole-holdout scores. No stock
risks are returned; replay is separate from the week-146 future scenario.
The existing React dashboard does not call this endpoint. After staff login,
open the endpoint URL directly for a JSON/DRF demonstration or request it using
the existing session. Do not pass this schema to `validateForecast`.

### Forecast and metrics endpoints

| Method | Relative path | Inputs | Success body |
| --- | --- | --- | --- |
| GET | `metrics/` | none | `api_version`, `model_status`, `metrics`, `warnings` |
| GET | `centers/` | none | `api_version`, `forecast_week`, `centers`, `warnings` |
| GET | `forecast/` | required integer `center_id`; optional integer `week` | Forecast response below |
| GET | `inventory-risk/` | same as forecast | Same forecast response, including risks and allocations |
| POST | `what-if/` | JSON below | Same forecast response with scenario flag set |

`week` defaults to the maximum historical week plus one. Any other horizon is
HTTP 400. Unknown centers are HTTP 400; known centers with no eligible history
produce an explicit 422 error. No implicit all-center forecast. The initial
scenario controls only promotion flags; no claimed causal uplift.

Metrics object retains training script names: `train_max_week`,
`validation_start_week`, `validation_end_week`, `train_rows`, `validation_rows`,
`model_wape_percent`, `lag1_baseline_wape_percent`, `model_beats_baseline`,
`warning`. WAPE is a percentage, not a fraction. `model_status` is `ready` only
with a genuinely trained and compatible artifact and metrics. Missing prerequisites
return 503, not fabricated metrics. Centers entries use `center_id` (integer),
`center_type` (string), `op_area` (number). City/region fields are not promised.

### Forecast response shape

This is a shape example with empty arrays, **not a generated forecast**:

```json
{
  "api_version": "1",
  "center_id": 1,
  "week": 146,
  "horizon_weeks": 1,
  "promotion_scenario": false,
  "sources": {
    "demand": "GENPACT_HISTORICAL",
    "operational": "SIMULATED",
    "product_mapping": "UNMAPPED"
  },
  "meal_forecasts": [],
  "ingredient_risks": [],
  "batch_allocations": [],
  "warnings": []
}
```

`146` is illustrative; use the returned `forecast_week`, never hardcode it.
`meal_forecasts` entries: `center_id`, `meal_id`, `week`, `predicted_orders`.
Predictions are nonnegative model estimates, not confirmed bookings or rounded
integer orders. Only meals with explicitly simulated recipes contribute to
ingredient calculations; list uncovered meal IDs in warnings.

`ingredient_risks` entries:

- `ingredient_id`: stable string key; quantities below are kilograms.
- `risk_type`: `expiry_surplus`, `shortage`, `expiry_surplus_and_shortage`, or `none`.
- `forecast_demand_kg`, `available_kg`, `expiring_unused_kg`, `shortfall_kg`:
  nonnegative numbers; demand equals sum of forecast orders times recipe kg/order.
- `potential_waste_cost_myr`: nonnegative number or null when any surplus cost is
  unknown; calculate each unused expiring batch at its own cost before summing.
- `illustrative_reorder_kg`: max(0, demand + simulated safety stock - eligible stock).
- `action`, `explanation`, `risk_inputs_note`: plain-language strings explaining
  forecast need, eligible stock, expiry bucket, uncertainty and proposed action.

`batch_allocations` entries: `batch_id` (string), `ingredient_id` (string),
`expiry_week` (integer), `eligible` (boolean), `exclusion_reason` (null or
`expired`), `consumed_kg`, `remaining_kg`, `potential_waste_cost_myr`.
All allocation is hypothetical. Expired batches consume zero. Eligible batches
allocate in `(expiry_week, batch_id)` order; current-week surplus is potential
waste, not measured spoilage. Include inventory-only ingredients with zero demand
so excess stock is visible. Initial simulated batches do not model received-week
or quarantine state; do not infer their absence in real stock.

Risk ordering: known potential waste MYR descending, then current-week expiry
surplus descending, shortfall descending, ingredient ID ascending. Unknown costs
must be disclosed in warnings rather than imply no risk. Shortage purchasing
costs require a separate verified supplier-price source; no guaranteed delivery
or savings. Promotion recommendations remain speculative.

### Nonpersistent scenario request

```json
{"center_id": 1, "week": 146, "promotion_scenario": true}
```

Reject unknown fields, booleans/fractions as integer IDs, nonboolean scenario
flags, unavailable centers and unsupported weeks. Set both observational promotion
flags for this hypothetical scenario; disclose that prices and other covariates
are assumed and response is not a causal comparison. Default forecast is
`promotion_scenario: false`.

## Local kitchen planning endpoint

`GET /api/admin/predictive/local-plan/?horizon_days=7` requires the same existing
Django staff/session permission. Only `horizon_days` is accepted: an integer
1–28, default 7. Repeated/unknown parameters and invalid integers return HTTP 400
`invalid_parameters`. POST returns 405. No center/week/Genpact mapping is involved.
The response uses `Cache-Control: private, no-store` and reads current database
rows on each call, without altering them. It does not require model artifacts,
historical CSVs or optional ML dependencies.

This is **known booking planning, not a model forecast or learned baseline**.
The five Genpact responses and their frontend validator remain unchanged. Do not
pass a local response into that validator or label it a live CatBoost forecast.
See [the frontend handoff](LOCAL-KITCHEN-INTEGRATION.md).

Top-level fields:

| Field | Type / meaning |
| --- | --- |
| `api_version` | String `"1"` |
| `mode` / `model_status` | `"local_plan"` / `"not_used"` |
| `as_of` / `timezone` | Current local ISO date / Django current timezone name |
| `window` | `start_date`, `end_date` ISO dates, `horizon_days` integer; inclusive |
| `sources` | `demand: "CONFIRMED_PAID_PREORDERS"`, `operational: "DATABASE"`, `product_mapping: "ACCEPTED_ORDER_RECIPES"` |
| `coverage` | Integer `active_orders`, `included_orders`, `excluded_orders`, `positive_batches`, `eligible_batches`, `hypothetical_batches` (0 in the baseline) |
| `included_orders` | Entries: integer `order_id`, `portions`; ISO `preparation_date`, `use_by_date`; `items`: nullable integer `product_id`, string accepted `product_name`, integer `quantity`; `requirements`: integer `raw_material_id`, numeric `quantity`, native `unit` |
| `excluded_orders` | Entries: integer `order_id`, string `reason` |
| `ingredient_risks` | Local material rows below, including inventory-only materials |
| `batch_allocations` | Integer `order_id`, `batch_id`, `raw_material_id`; numeric `quantity`; `unit`; ISO `needed_by`, `use_by_date` |
| `batches` | Integer `batch_id`, `raw_material_id`; `unit`; numeric `quantity`, `allocated_quantity`, `remaining_quantity`; ISO `received_date`, `expiry_date`; boolean `eligible`, `hypothetical` (false in baseline); string array `exclusion_reasons`; additive string `batch_code` (empty for a nonpersistent purchase scenario) |
| `shortages` | Integer `order_id`, `raw_material_id`; numeric `quantity`; `unit`; ISO `needed_by` |
| `recommendations` | Integer `priority` starting at 1, `raw_material_id`; `ingredient_id`, `risk_type`, nullable ISO `urgent_by`, `action`, `explanation` |
| `warnings` | Array of strings, always display source/coverage caveats |

Orders considered are `pending` or `processing` only. Include paid orders whose
inventory has not already been deducted, with a nonempty reviewed preparation
plan (`needs_review` absent/false), valid preparation start/end and delivery.
The start date must fall in the inclusive window; end may fall after it. Require
batch expiry on/after the preparation end date, conservatively covering the whole
preparation period. No delivery/consumption dates are invented from creation dates.
Require a complete accepted recipe snapshot for every item; do not fall back to
today's mutable menu recipe. Units convert `g` ↔ `kg`, `ml` ↔ `l` and `unit` ↔ `unit`.
Mass/volume conversions are rejected. Invalid/nonpositive quantities or a missing
recipe exclude the entire order, avoiding misleading partial requirements.

Exclusion reasons: `inventory_already_deducted`, `not_paid`,
`preparation_needs_review`, `missing_schedule`, `invalid_schedule`,
`overdue_preparation`, `outside_horizon`, `missing_items`,
`missing_accepted_recipe`, `invalid_recipe_quantity_or_unit`.
Cancelled/delivered/cooked/shipped orders are outside the active-order query, not
future demand. `coverage` describes only this query; it is not a total order count.
Unpaid COD orders are also excluded under this conservative paid-order policy.

Positive stock batches are ineligible if quarantined, already expired, not yet
received, or expiry precedes receipt. These reasons may overlap. Eligible expiry
dates are inclusive. Allocate order-by-order by preparation timestamp, then order
ID; within each material use earliest expiry then batch ID. Allocate a batch at
most once across requirements. Quantities are in each raw material's recorded
unit, **not always kg**. No demand prediction or safety stock is added.

Local `ingredient_risks` entries:

- `ingredient_id`: stable `"raw-material-<ID>"` string; integer `raw_material_id`;
  `ingredient_name`, `unit` strings. These IDs identify database materials.
- `risk_type`: `expiry_surplus`, `shortage`, `expiry_surplus_and_shortage`, `none`.
- `confirmed_requirement`: sum of accepted per-portion quantities × included
  item quantities, converted into the material's unit.
- `eligible_stock`: currently eligible stock; it may expire before an order's
  preparation end and therefore need not cover the requirement.
- `allocated_quantity`: sum of advisory FEFO allocations.
- `shortfall_quantity`: requirement minus allocated quantity, not merely
  requirement minus on-hand stock.
- `expiring_unused_quantity`: unallocated eligible stock dated to expire on or
  before `window.end_date`; excludes already expired/held/not-received batches.
- `potential_waste_cost_myr`: sum of expiring unused quantities × each batch's
  recorded `unit_cost`; null if any contributing cost is missing; zero if no
  expiry surplus. This is estimated exposure, not observed waste or savings.
- `estimated_purchase_cost_myr`: shortfall × material `estimated_unit_cost`,
  or null when absent. A recorded estimate, not a supplier quote or lost revenue.
- `urgent_by`: earliest shortage preparation date or unused batch expiry date,
  nullable for no risk; `action`, `explanation` are plain strings.

Risks/recommendations sort by risk before no-risk, earliest urgency date, known
waste cost before unknown, descending known waste exposure, material ID. Do not
compare gram and litre quantities as a financial/severity ranking. Shortage
purchasing spend is not treated as the value of lost sales. No supplier lead times,
causal promotion effects, financial savings, purchases or stock deductions exist
in this endpoint. The separate hypothetical purchase endpoint below does not
execute any purchase or predict additional demand.

The frontend must show excluded-order warnings even when requirements/risks are
empty. A successful empty calculation is **not proof of zero shop demand**. The
database may contain fictional demo records; `DATABASE` means storage provenance,
not verified customer activity. Dates and costs remain owner-maintained inputs;
their use is not a guarantee of food safety or real-business forecast accuracy.

### Local hypothetical purchase comparison (implemented)

`POST /api/admin/predictive/local-scenario/` uses the existing staff session and
requires CSRF. GET returns 405. Request JSON:

```json
{
  "horizon_days": 7,
  "raw_material_id": 16,
  "quantity": "300.000",
  "unit_cost": "0.020000",
  "arrival_date": "2026-10-12",
  "expiry_date": "2026-10-16"
}
```

This is a shape example, not a current supplier quote. `horizon_days` defaults
to 7 (1–28). The other five fields are required. Material must exist; quantity
is positive with at most three decimal places; unit cost is nonnegative with
at most six decimal places or null (unknown). Dates are ISO calendar dates;
arrival must be inside the current inclusive window; expiry must be on/after
arrival. Unknown fields, invalid values and non-object bodies return 400
`invalid_parameters`; serializer errors may also include an `errors` object.
The quantity/cost are always in the selected material's native unit. There is
no arbitrary unit conversion, promotion uplift, demand multiplier or automatic
supplier selection. Past receipt dates are not accepted.

Success fields: `api_version: "1"`, `mode: "local_purchase_scenario"`, `purchase`,
`baseline`, `scenario`, `warnings`. `purchase` echoes the validated inputs plus
`unit` (decimal fields are strings or null). Both plans use the local-plan schema
above and are calculated from one shared database snapshot. `scenario.sources`
changes only `operational` to `DATABASE_WITH_HYPOTHETICAL_PURCHASE`.

The hypothetical batch has `batch_id: -1`, `hypothetical: true`; it may appear
in allocations. All database batch IDs remain positive. Scenario allocations
require its arrival on/before order preparation start and expiry on/after
preparation end. Overbuying can create additional expiry exposure. Baseline
costs remain recorded estimates; assumed new-batch cost stays unknown if null.
`positive_batches` counts database batches; `hypothetical_batches` is 1 in the
scenario; `eligible_batches` includes the hypothetical candidate. Scenario
`eligible_stock` includes the assumed future purchase and is not current
on-hand inventory. No order, stock, payment or purchasing row is changed.
Responses use `Cache-Control: private, no-store`.

The existing React assistant now defaults to `source=local` (also when omitted),
with `horizon=7` by default. It uses a distinct local validator and native units,
shows coverage/exclusions, menu snapshots and stock evidence, and calls this
comparison with CSRF. `source=live` retains the Genpact model demonstration;
`source=demo` retains explicitly labelled frontend fixtures. Local mode never
loads Genpact metrics or silently substitutes frontend fixtures. Switching
sources clears selections; editing purchase inputs clears prior comparisons.

## Errors and synchronization

Predictive error body:

```json
{"code": "model_unavailable", "detail": "Train and evaluate the demand model before requesting forecasts."}
```

Codes: HTTP 400 `invalid_parameters`; 422 `no_eligible_history`; 503
`source_data_unavailable`, `model_unavailable`, `operational_data_unavailable`.
Authentication errors retain existing DRF `detail` behavior. Unexpected failures
use the existing sanitized exception handler; never expose filesystem paths,
CSV contents or tracebacks. Dashboard should render these states explicitly.

Backend endpoint tests must enforce field names, finite JSON numbers, staff
permissions, CSRF, invalid input, missing model/data, FEFO and no database writes.
Update this document in the same commit as endpoint/schema changes. Frontend mocks must be explicitly labeled fixtures.

# Local delivery forecast (implemented 2026-10-16)

## Forecast-to-decision integration

`GET local-decisions/?horizon_days=1..28` returns the existing local-plan envelope
plus `decision_support` (source LOCAL_KITCHEN): per-menu daily baseline forecasts,
chronological evaluation, recipe coverage, ingredient projections, sensitivity
ranges, alert/review counts and assumptions. `POST local-decision-scenario/`
accepts the existing local-scenario purchase fields and returns enriched baseline
and hypothetical-purchase plans, both recalculated from stored records. These
endpoints are staff-only, private/no-store and do not mutate operational records.
The inherited `model_status: not_used` describes confirmed-order allocation;
`decision_support.forecast_status` separately reports evaluated_baselines,
limited_baselines or insufficient_history for the forecasting layer.

`POST local-reviews/` accepts request_id UUID, raw_material_id, horizon_days,
action (purchasing/menu/marketing/wait), optional note (1000 chars), nullable
nonnegative action_cost and nullable assumed_avoided_percent (0..100). It returns
a signed, fresh snapshot and token for browser storage/export, not a server log.
`POST local-review-outcomes/` accepts only token, verifies its signature/one-year
age, and returns recorded waste for snapshot batches and calendar-day delivered
paid portions for mapped menus. Both require staff session/CSRF and perform only
database reads. Invalid/tampered tokens return 400. Neither sends marketing,
deducts inventory, reschedules orders or records financial transactions.

See [Showcase local kitchen guide](SHOWCASE-LOCAL-KITCHEN.md) for the complete
target, evaluation splits, forecast de-duplication, false-alarm policy, browser
review persistence, worksheet assumptions, limitations and impact protocol.

The local decision assistant and forecast page both display the website-order
baseline. Stock-planning exclusions do not hide this panel. The response includes
`database_coverage` (all order counts by status), `recent_orders` (latest 50 order
IDs, effective dates with provenance, statuses, payment states and portions; no
customer details), and `baseline` (four-week sales moving average). The baseline
is shown first, independently of the optional fitted-model comparison.

`recorded_preorders` separately reports historical non-cancelled, non-refunded
preorder volume and its four-week moving average. It includes unpaid/unfinished
orders and is explicitly **not realised sales**. This fallback is visible when
there is no eligible paid delivered sales history. Both series use completed
effective-delivery weeks and explicit preorder-date fallbacks. Future/current
week records remain visible in `recent_orders` but do not enter either baseline.

`GET /api/admin/predictive/local-forecast/` is staff-only, takes no parameters,
and returns `Cache-Control: private, no-store`. It does not load Genpact CSVs,
CatBoost or optional ML packages. Its response is independent of `local-plan/`:
historical orders do not need accepted ingredient recipes to contribute to sales.

The target is aggregate **portions**, not distinct order count, per completed
Monday–Sunday week in the Django application timezone. `history` also reports
distinct orders per week. Only paid, delivered orders are eligible; refunded,
cancelled, unfinished and invalid/future dates are excluded. The current partial
week is excluded from training. `forecast_week_start` identifies the full current
week forecast from the last completed week. `next_week_portions` is the one-step
forecast after that completed history, not a forecast for seven days from now.

Dates use `delivery_at`, falling back to the existing preorder `created_at` date
when missing. `estimated_date_orders` reports eligible orders using that fallback.
These are imputed reporting dates, not recovered delivery facts. No delivery
promises, preparation schedules, payment states or inventory are changed.
The sales analytics endpoints use this delivery-date basis too, and recognise
paid delivered sales rather than treating paid future bookings as realised sales.

Response fields include `source: LOCAL_KITCHEN`, `status`, `eligible_orders`,
`estimated_date_orders`, `excluded_orders`, `history_weeks`, `history`,
`selected_method`, `next_week_portions`, `candidate_model_trained`, `model`,
`evaluation`, and `warnings`. Empty eligible history returns
`status: insufficient_history` and a null forecast, not zero demand.

Generated-history provenance is additive: `local-forecast/` returns integer
`synthetic_history_orders` for eligible generated daily summaries, and
`recent_orders[].synthetic_history` is boolean. `local-decisions/` exposes
`decision_support.synthetic_history_items` and each menu's
`synthetic_history_items` as nonnegative item counts. These flags do not mean
real customers transacted. Warnings, replay UI and exported training records
identify generated history. A numerical evaluation can still run on synthetic
inputs; its result establishes no real-world accuracy. The UI excludes menus
with generated history from its evaluated-confidence count.

`/api/admin/analytics/` additionally returns
`analytics.synthetic_history_orders`, an all-time count of generated paid,
delivered daily summaries so sales totals/average order values can be labeled
as including artificial data. A daily summary is not a distinct customer order.

The local decision response also carries calculation evidence without changing
the forecasting or FEFO rules:

- Each menu's `demand_adjustments` contains numeric `delivery_day_excluded`,
  `lead_time_excluded`, `capacity_excluded`, and `recorded_orders_offset` portions.
  These are distinct, non-overlapping deductions from the full-window forecast.
  `additional_forecast_portions` is the remaining plan-eligible additional demand,
  not simply total forecast minus confirmed bookings. Recorded offsets can include
  unpaid requests to avoid counting their portions again.
- Each ingredient risk's `stock_flow` includes numeric `opening_quantity`,
  `confirmed_allocated`, `after_confirmed`, `forecast_consumed`,
  `projected_total_remaining`, `projected_expiring_unused`, and
  `projected_carried_stock`, all in its native unit. `batches` provide per-lot
  `batch_id`, `batch_code`, `raw_material_id`, `unit`, `expiry_date`,
  `opening_quantity`, `confirmed_allocated`, `after_confirmed`,
  `forecast_consumed`, `projected_remaining`, boolean `expires_in_window`, and
  nullable numeric `unit_cost`. `allocations` list forecast-use `date`,
  `batch_id`, `raw_material_id`, and numeric `quantity`.
- `opening_quantity - confirmed_allocated - forecast_consumed` equals total
  remaining stock; this separates into expiring unused stock and stock dated
  after the window. Forecast requirement equals forecast consumed plus forecast
  shortfall. Rounded API totals can differ by a small rounding amount.
- `review_reasons` is a string list of applicable history, provenance, coverage
  and dated-stock concerns; review cards no longer imply every possible concern
  applies to every ingredient. Existing signal thresholds are unchanged.

All of this is a read-only projected ledger: no stock movement or purchase is
recorded. Zero projected expiry waste can coexist with uncovered forecast demand.

Short histories use `moving_average_4_weeks` and `status: baseline_only`.
At 14 or more completed weeks, reserve the latest ceil(20%) for testing and the
preceding ceil(20%) for validation; at least eight earlier training weeks are
required. Compare moving average, last week, and ridge autoregression with fixed
regularization 10 and intercept/lag1/lag2/prior-four-week-mean features. Choose the
method by validation MAE only. Fit regression on train+validation for the test;
all test predictions use only actual earlier observations, so this is a rolling
one-week evaluation, not an unattended multiweek forecast. Report each method's
test MAE and WAPE (null when actual test volume is zero). Refit coefficients on
all completed history for production inference; saved coefficients can be used
with `myapp.services.kitchen_forecast.predict`.

The model artifact and prepared training records can be exported against the
configured kitchen database, without raw customer details:

```sh
python backend/manage.py train_kitchen_forecast --output work/kitchen-forecast.json
```

Use a new output filename for each run. The JSON contains aggregate history,
evaluation, fitted coefficients and `prepared_orders` with `preorder_date`,
`sales_date`, `sales_date_basis`, portions and order ID. Missing delivery dates
therefore have complete, explicitly marked dates in the training dataset. Files
are private (0600) and must stay outside Git. No trained-model accuracy on the
user's kitchen can be claimed until its populated database is available.

Missing calendar weeks are zero **recorded sales**, with recording coverage and
menu availability unverified. Demo orders remain demo evidence. Aggregate demand
cannot identify dish-specific ingredients; confirmed bookings still drive stock
planning, and forecast quantities must not be blindly added to them.
