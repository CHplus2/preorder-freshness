# Predictive API contract — Dormathon 2026

Version: `1` (implemented). Backend branch: `feature/ai-backend`.
Dashboard branch: `feature/ai-dashboard`.

## Availability and scope

**All five endpoints below are implemented**. The evaluated CatBoost artifact
achieved 28.23% WAPE versus 34.81% baseline on weeks 136–145. A complete separately
provisioned bundle and optional ML dependencies are required; Git alone does not
supply them. See `backend/predictive_ai/README.md` for reset and deployment steps.
Generated operations currently cover center 13 only; other centers return HTTP
503 `operational_data_unavailable`. No empty/fabricated forecast is substituted.

The forecasting domain is external Genpact **weekly** center/meal demand.
`meal_id` is never a Dapur Kita `Product.id`. Recipe, stock, costs and supplier
inputs initially use explicit simulated operational data. No local FYP stock is
read or modified by this demo. A real-data adapter requires an explicit,
verified mapping and unit conversion; it is outside this initial contract.

## HTTP rules

Base: `/api/admin/predictive/`; trailing slashes required. JSON UTF-8. All
operations require Django staff permission (`IsAdminUser`) and existing session
authentication. Session-authenticated POST requires CSRF using existing frontend
conventions. Anonymous/nonstaff requests return HTTP 403 under existing DRF
session defaults. GET is read-only; POST scenarios are nonpersistent and cannot
send messages, deduct stock, or create orders.

Integers: IDs and week indices; floating-point numbers: forecasts, kg quantities,
MYR amounts and percentage metrics. Unknown costs are `null`, never zero.
All output numbers must be finite. Arrays may be empty only after a successful
calculation. Weekly expiry is an inclusive bucket, not a calendar date or proof
of food safety. Prices and operational quantities must not be labeled real.

## Endpoints

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
