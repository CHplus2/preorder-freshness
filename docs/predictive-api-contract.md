# Predictive dashboard API — proposed frontend contract

**Proposal awaiting backend agreement.** No predictive contract/endpoints existed in this checkout. Coordinate with the backend developer before using Live API. This document does not describe a confirmed deployed API. No Django logic, FEFO algorithm or ML model is included.

Staff routes: `/admin/ai/forecast`, `/admin/ai/inventory`, `/admin/ai/decisions`. Demo data is synthetic and explicitly labeled; live errors never fall back to mocks. The backend must enforce staff permissions. Requests include Django session cookies.

## Proposed read-only endpoints

`GET /api/predictive/options/`:

```json
{"menu_items":[{"id":"nasi-lemak","name":"Nasi lemak"}],"fulfillment_centers":[{"id":"north","name":"North campus kitchen"}]}
```

IDs are strings. Empty arrays are valid. Demo centers do not establish real operational centers.

`GET /api/predictive/dashboard/?menu_item_id=nasi-lemak&fulfillment_center_id=north&scenario=baseline`

`scenario` is `baseline` or `promotion`. Promotion is always a what-if simulation. GET must not execute purchases, change inventory, activate promotions or train models.

| Field | Meaning |
| --- | --- |
| `source` | `model` for backend results; `mock` for synthetic data |
| `generated_at`, `as_of_date` | ISO timestamp with timezone and YYYY-MM-DD inventory reference date |
| `menu_item_id`, `fulfillment_center_id`, `scenario` | Exact selection echoed back |
| `currency` | `MYR` |
| `uncertainty_label` | Explanation of range, coverage and limitations |
| `assumptions` | Explanatory strings, including promotion uplift and omitted costs |
| `forecast` | Array of `{week_start, actual_demand, predicted_demand, lower_bound, upper_bound}` in portions/week |
| `inventory_risks` | Array of `{ingredient_id, ingredient_name, unit, expiry_date, days_to_expiry, stock_quantity, predicted_consumption, surplus_quantity, projected_loss, urgency, issue_category, reason}` |
| `recommendations` | Array of `{id, ingredient_id, ingredient_name, priority, unit, purchase_quantity, action, reason, projected_waste, projected_loss}` |
| `comparison` | `{baseline: {purchase_cost, projected_loss}, recommended: {purchase_cost, projected_loss}}` |

Complete synthetic example: `frontend/src/features/predictive/mockData.js`.

Demand values may be null when unavailable; each row needs actual or predicted demand. Bounds must both be null or satisfy lower ≤ predicted ≤ upper. Unknown is never zero. Quantities/costs are finite nonnegative numbers; priority is a positive integer (1 first); days to expiry is an integer and may be negative. Dates represent Malaysia business days. Week starts, ingredient IDs and recommendation IDs must be unique. Inventory, recommendations and comparison must use the same selected menu, center, scenario and forecast horizon. Units are consistent per ingredient and never summed across ingredients.

Urgency: `critical`, `high`, `medium`, `low`. Business issue: `expiry_surplus`, `overstock`, `stockout`, `quality_hold`. Backend provides categorization, FEFO/consumption, recommendations and explanations; frontend only displays them. Financial impact is projected waste cost, not realized savings or net profit. Disclose omitted promotion, labor and delivery costs.

Return arrays, including empty arrays, without pagination envelopes. Use 401/403 for denied access, 404 for missing endpoints, and non-2xx for errors. The frontend rejects malformed data, checks echoed selection, and cancels obsolete requests.

## Validation

From `frontend`: `npm ci`, `npm run test:predictive`, `npm run build`. Run the existing suites with `npm test`, and the predictive adapter checks with `npm run test:predictive`. Node's built-in test runner adds no dependency. Browser checks should cover all views at desktop/mobile sizes, selections, simulation labels, accessible exact chart values, live error/retry, empty options/results and staff access. Actual model/API integration remains unverified until the backend implements an agreed contract.
