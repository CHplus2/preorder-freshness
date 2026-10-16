# FreshCast review: Genpact to kitchen decisions

Reviewed 2026-10-16. UI branch: feature/ai-dashboard. Backend reference: ac967c2; kitchen implementation inspected on integration/dormathon-demo at da57820. This is a source/API review, not an audit of a populated production database, deployment or newly evaluated model. No backend/ML files were changed and no model was trained. Existing integration frontend modules were selectively reused; no branch merge was performed.

## Main conclusion

Reuse the forecasting workflow and decision pipeline, not Genpact's product IDs, learned demand levels, prices or accuracy claim. The kitchen already has its own aggregate sales forecaster and database planning endpoints on integration. The immediate working connection is kitchen sales forecasting beside confirmed-order recipe/stock planning. It is not yet a combined forecast-driven expiry estimator.

## What exists

| Evidence | Genpact demonstration | Kitchen implementation on integration |
|---|---|---|
| Target | Weekly center/meal demand (`num_orders`) | Paid delivered portions per completed week, aggregated across dishes |
| Identifiers | External center/meal IDs | Local order/product/material IDs and accepted order recipes |
| Forecast | Evaluated CatBoost with lag1, lag2, prior rolling4, price/promotion/category/center features | Moving-average baseline; existing ridge/last-week candidates selected using chronological validation when enough history exists |
| Inventory | Simulated weekly recipes, batches, costs and supplier assumptions | Recorded batch quantities, dates, holds and recorded/estimated costs; native g/kg/ml/l/unit |
| Decision inputs | Model estimates translated through simulated recipes | Confirmed paid upcoming orders translated through accepted recipes; advisory dated FEFO |
| API | metrics, centers, forecast, inventory-risk, what-if | local-forecast, local-plan, local-scenario |

The 28.23% Genpact WAPE versus 34.81% baseline is the documented historical evaluation, not measured kitchen accuracy. Earlier readiness documents report five mapped demo meals out of 51 forecasts; that is a historical verification result, not a fresh live run here.

## Findings, in priority order

1. **Aggregate demand cannot identify expiry consumption.** `kitchen_forecast` returns total portions for a full calendar week. It cannot determine chicken demand, menu mix or consumption before tomorrow. Do not allocate it proportionally by guessed recipes or apply the entire weekly total before an early expiry.
2. **Bookings and forecasts overlap.** `local-plan` already allocates known paid bookings. Adding its requirements to a total-demand forecast counts those bookings twice. A combined endpoint must define forecast as total demand (with a documented residual calculation) or unbooked incremental demand. This is a backend modeling contract, not frontend arithmetic.
3. **Local leftover is not final predicted waste.** Current `expiring_unused_quantity` is eligible stock left after included confirmed orders, within the planning window. Unbooked demand may consume it. Label it exposure against known bookings, not a prediction that it certainly will not sell.
4. **Forecast dates need care.** `local-forecast` excludes the current incomplete week, then predicts the full current Monday–Sunday week from completed history. It does not predict seven days from the request date. A request late in the week needs an explicitly dated remaining-demand horizon before it can drive expiry decisions.
5. **Kitchen data quality controls model usefulness.** Missing delivery dates fall back to creation dates in the current aggregate forecaster; these are reporting estimates, not recovered delivery facts. The separate strict local-preorder audit excludes missing delivery dates instead. These are different datasets and their evaluation results are not interchangeable. Keep fallback counts visible and evaluate sensitivity with/without estimated dates.
6. **Missing calendar weeks are not necessarily zero demand.** Current aggregate history fills zero recorded sales. Closed days, unavailable menus, stockouts, missing records and fictional/relabelled records must be distinguished before inferring true demand. Retain provenance and availability evidence.
7. **FEFO requires time and native units.** Respect receipt, preparation start/end, expiry, holds and existing deductions. Use batch-specific costs; unknown stays null. Do not convert ml to g, units to kg, or totals across unlike materials without verified conversion data. Weekly Genpact expiry is not an actual kitchen calendar deadline.
8. **Promotion is not a learned rescue effect.** Genpact promotion flags are observational. The chicken rescue story uses authored totals and prices. Neither supports claiming a real 20% discount or bundle will sell 18 portions in this kitchen. Real action uplift needs independent evidence.
9. **The UI branch was behind integration for local APIs.** This change reuses the existing kitchen frontend, defaults to My kitchen, preserves explicit Genpact/fixture modes, adds a native-unit database fridge, and strengthens contradictory forecast-response validation. Backend routes must still be present in the deployed integration; a UI-only checkout cannot provide them.

## Reuse Genpact's approach with kitchen data

Use stable local product identities and fulfilment/consumption dates, not a numeric mapping to Genpact meal IDs. Preserve menu name/recipe versions when products change. Prepare a product/date panel only where order recording and menu availability are known. Useful forecast-time features include prior fulfilled portions, shifted rolling demand, weekday/opening schedule, known bookings as of the forecast cutoff, actual menu prices and recorded promotion exposure. Never use final payment/status, future sales or stock movements as historical forecast-time features.

Use the teammate's existing forecasting service. Evaluate on chronological validation and a later untouched test, comparing against simple moving-average/seasonal baselines. Report local MAE/WAPE by horizon/product, sparse-history fallbacks and recording coverage. Do not inherit Genpact metrics, train another competing model in this UI branch, or fabricate historical deliveries to improve coverage.

## Backend contract needed for the missing connection

Extend the teammate's service with dated, product-level **remaining demand before expiry**, or return an explicit unsupported/insufficient-history state. Proposed requirements, not agreed new endpoint names:

- Forecast as-of timestamp/timezone, target dates, product IDs and recipe version, per-date expected portions, provenance and method/evaluation metadata.
- Explicit total-versus-incremental demand semantics and booking overlap treatment. A total forecast may leave no residual after known bookings; the residual must not reduce already committed requirements.
- Accepted recipe snapshots for bookings; reviewed current recipe/version for predicted unbooked meals; native-unit conversions and mapping coverage. Warn on unmapped meals rather than silently treating their consumption as zero.
- Shared stock snapshot and read-only dated FEFO for baseline and scenarios. Identify expired, held, not-yet-received and already-deducted stock. Preserve allocation evidence and eligibility through preparation completion.
- Separate confirmed allocation, additional predicted allocation, at-risk remainder before each expiry, shortages and unknown costs. Avoid allocating any batch twice across products/scenarios.
- Compare reduce/defer purchasing, verified ingredient-consuming dishes, and user-assumed promotions. Label action-effect assumptions; include side/packaging/setup costs where known, constraints/capacity, and sensitivity. Do not call contribution net profit or double-count waste cost already included in purchases.
- Return calibrated uncertainty only if evaluated locally; otherwise provide explicitly assumed sensitivity scenarios. Expose missing history, menu availability, dates, recipe coverage and cost limitations.

Conceptually, for each eligible batch: remaining quantity after dated confirmed allocation and dated additional-demand allocation is potential expiry exposure. Use the shared simulator's actual allocations, not a frontend subtraction of aggregate demand from stock. Financial exposure sums the affected batch quantities × their own known costs; any missing contributing cost makes the monetary total unknown.

## Concrete decision example (illustration only)

Suppose a dated chicken batch has 2 kg remaining after confirmed bookings. Reviewed recipe use is 0.1 kg/portion, so 20 portions would use it. If a supported product/date forecast estimates 11 **additional** portions before expiry, 1.1 kg would be consumed and 0.9 kg remains exposed. A bundle scenario assuming 18 additional portions leaves 0.2 kg; those sales are hypothetical unless the action effect has been validated. Check other ingredients, kitchen capacity, expiry eligibility, price and contribution before recommending it. Current aggregate `local-forecast` alone cannot supply these eleven product/date portions.

## Validation and limits

Frontend unit/build/lint and contract-fixture browser validation accompany this change. No production data export, new training, actual ingredient forecast, real promotion effect or Vercel deployment has been established by this review. Existing source claims about deployment/data are reported as documentation, not independently reverified facts. Kitchen backend changes and populated-data evaluation remain with the backend developer.

Validation completed: 35 predictive frontend tests, existing frontend/UX/planner/checkout suites, production build and changed-file ESLint passed. Contract-fixture browser checks verified local default/no Genpact requests, database fridge/native grams, empty historical forecast, mobile overflow, local API failure with no fixture fallback, and preserved explicit fictional demo access. The existing main-bundle size warning remains. No production kitchen dataset or live API was queried.
