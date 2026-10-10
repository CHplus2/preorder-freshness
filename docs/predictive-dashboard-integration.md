# React integration with predictive API v1

Frontend branch: `feature/ai-dashboard`. Backend schema inspected at `69d0061` on `origin/feature/ai-backend`; `docs/predictive-api-contract.md` now matches that implemented contract. No backend/ML changes or branch merge are included.

The adapter calls the five `/api/admin/predictive/` endpoints using session credentials. It loads metrics and centers, uses the returned `forecast_week`, requests `forecast/` or `inventory-risk/` for the selected center, and POSTs integer center/week plus boolean `promotion_scenario` to `what-if/` with `X-CSRFToken` from the existing cookie helper. Baseline and promotion results are validated independently and compared only for the same center/week. Version, sources, numeric types, nullable costs and response selection are validated. Aborted requests cannot replace a later selection.

Live API is the default. Frontend fixtures are an explicit separate source with prominent labels and are never a fallback for failed requests. URL parameters retain source, center, scenario and meal selection between views. Center 13 is initially selected if returned because the documented operational bundle covers it. Other centers remain selectable and display the backend's operational-data error honestly. Missing deployment (404), staff/CSRF denial, invalid selection (400), insufficient history (422) and prerequisite failures (503) have explicit error/retry states. Empty successful collections have separate empty states.

## Domain and display limits

- Genpact meal IDs are not FYP Product IDs. The meal selector filters returned demand only; inventory and decision results remain center-wide, visibly labeled.
- Demand is a one-week model estimate. No calendar dates, weekly history, confidence intervals or demand quantities are invented. WAPE is shown as a percentage from returned holdout metrics, not used to derive uncertainty bounds.
- Recipes, stock, safety stock, supplier inputs and costs are SIMULATED; no local inventory is changed. Expiry uses inclusive week buckets rather than dates/days remaining. Batch allocations display backend FEFO results without reimplementing FEFO.
- `null` costs display as unknown; summary totals show a known subtotal with incomplete-cost disclosure. Risk priorities follow backend waste/expiry/shortfall ordering. `none` records remain visible in inventory but are excluded from recommendations.
- Promotion comparison uses returned hypothetical flag results and clearly disclaims causal uplift. Baseline-vs-optimized purchasing spend, net profit and savings are unavailable in v1 and are not fabricated.

## Additional fields needed to restore the original expanded dashboard scope

No schema changes are required for this v1 integration. For future features, the backend would need to supply: historical weekly actual demand; calibrated uncertainty bounds and coverage metadata; verified meal-to-local-product mappings and display names; ingredient labels/calendar expiry and handling metadata if real stock is introduced; and comparable baseline/recommended purchasing costs and outcomes from verified supplier pricing. These are requests for a separate backend task, not assumptions used by React.

## Validation and integration handoff

From `frontend`: `npm run test:predictive`, `npm test`, `npm run test:ux`, `npm run test:planner`, `npm run test:checkout`, `npm run build`. Browser fixture checks verify live requests, all views, scenario CSRF, selection retention, error/retry, empty results, staff gating, and mobile layout. Fixture-based checks do not prove deployment/model readiness.

After explicitly integrating both branches, provision the complete backend bundle and ML dependencies according to `backend/predictive_ai/README.md`, use an isolated database and staff session, and repeat metrics/centers/forecast/inventory/scenario smoke checks against the actual Django server. Accept only `model_status: ready` and validated successful responses. A Git-only checkout lacks the trained artifacts. Do not train a second model or use production stock for testing.
