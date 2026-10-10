# Predictive API contract — Dormathon 2026

Version: `1` (implemented). Current integration branch: `integration/dormathon-demo`.
Dashboard branch: `feature/ai-dashboard`.

## Availability and scope

**The five Genpact endpoints and separate `local-plan/` endpoint are implemented**.
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
| `coverage` | Integer `active_orders`, `included_orders`, `excluded_orders`, `positive_batches`, `eligible_batches` |
| `included_orders` | Entries: integer `order_id`, `portions`; ISO `preparation_date`, `use_by_date` |
| `excluded_orders` | Entries: integer `order_id`, string `reason` |
| `ingredient_risks` | Local material rows below, including inventory-only materials |
| `batch_allocations` | Integer `order_id`, `batch_id`, `raw_material_id`; numeric `quantity`; `unit`; ISO `needed_by`, `use_by_date` |
| `batches` | Integer `batch_id`, `raw_material_id`; `unit`; numeric `quantity`, `allocated_quantity`, `remaining_quantity`; ISO `received_date`, `expiry_date`; boolean `eligible`; string array `exclusion_reasons` |
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
in this endpoint. No local what-if endpoint is implemented.

The frontend must show excluded-order warnings even when requirements/risks are
empty. A successful empty calculation is **not proof of zero shop demand**. The
database may contain fictional demo records; `DATABASE` means storage provenance,
not verified customer activity. Dates and costs remain owner-maintained inputs;
their use is not a guarantee of food safety or real-business forecast accuracy.

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
