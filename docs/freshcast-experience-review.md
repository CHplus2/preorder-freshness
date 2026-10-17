# FreshCast kitchen and Genpact experience review

## Functional review before visual alignment

The core kitchen flow is an advisory decision workflow: delivery-based menu
estimates → current recipe needs → dated eligible stock → projected surplus/gap
→ a reviewed purchase or marketing scenario → existing operations pages. It is
not an autonomous purchasing, promotion or scheduling system.

| Area | Finding and action |
| --- | --- |
| Forecast target | Kitchen menus use paid, delivered history; Genpact uses external weekly demand. Neither is a confirmed customer booking. Algorithms unchanged in this batch. |
| Stock allocation | Dated FEFO can produce zero expiry waste and a forecast shortage together. Later-expiring remaining stock carries forward. Existing backend chicken regression verifies the example arithmetic. |
| Missing history or model | Existing loading/error/empty states remain; failed API requests never silently become fixtures. Kitchen responses must match the requested horizon. |
| Ingredient hand-off | Fixed kitchen fridge selection being lost when navigating from the assistant. Ingredient/filter selections now persist in URL state for both source inventory views. |
| Planner shopping | Added material focus and a show-all control. This filters existing shopping requirements; it does not insert forecast demand as an order or purchase. |
| Confirmation boundaries | Planner shopping may include requests excluded from FreshCast's confirmed-stock plan. A visible explanation prevents treating both totals as identical. Backend eligibility alignment remains outstanding. |
| Forecast dates | Kitchen uses delivery dates conservatively for speculative needs; the scheduler still must verify preparation dates, holding limits, resources and capacity. |
| Saved decisions | Kitchen reviews are signed browser-held snapshots; Genpact exports a briefing. Neither is a shared operational decision log. |
| Deployment identity | The reported `preorder-freshness-p239jmc2i-...vercel.app` address is a deployment-specific URL, with a selected 14-day horizon. Pushing commits does not update an old deployment's contents. Added a build revision footer to both sources. Production promotion is not verified by this audit. |

## UI changes and parity decisions

| Feature | Shared experience now | Source-specific meaning retained |
| --- | --- | --- |
| Decision journey | Same five-step component, labels, keyboard semantics and active-step state. | Kitchen uses raw-material IDs and confirmed/forecast gaps; Genpact uses external ingredients and simulated operations. |
| Navigation | Same decision assistant, inventory evidence and demand analytics stations. | Local menu counts and ready orders versus external meals and fulfillment centers. |
| Source controls | Same selector, concise source notice and build identity. Source choice is visible without opening technical settings. | Generated kitchen history, model-backed Genpact demand and frontend fixtures stay explicitly distinct. |
| Typography | Main summaries are 15px, normal weight, with a readable line length. Review reasons are 14px regular text under a disclosure. Numbers and headings retain emphasis. | Source limitations remain accessible without becoming the primary headline. |
| Fridge | Reuses the same planning cabinet, ingredient inspection, waste/stock-gap filters and a return-to-decision link. | Real recorded local batches versus Genpact weekly simulated batches; no invented local mapping or shelf storage instructions. |
| Zero waste | Same explanation: no eligible stock is projected to expire unused in the window, with later-expiring carry stock shown when supported. | Kitchen carries native-unit ledger quantities; Genpact carries eligible later-week batch remainders. Missing batch evidence stays unknown. |
| Demand evidence | Select a menu/meal, then inspect forecast evidence and optional technical detail. | Kitchen can show delivery-day forecasts and history; Genpact API v1 supplies one forecast week. No daily Genpact history is fabricated. |
| Actions | Review alternatives and compare estimated effects before acting. | Kitchen purchase API can recompute a dated stock scenario; Genpact promotions change model flags. Kitchen marketing response remains a manager assumption. |

The old warning-heavy title (`Needs verification: Butter`) is no longer rendered
by the current kitchen assistant. The heading is the business issue, such as
`Stock may run out`, while review reasons remain expandable. A footer reading
`FreshCast · Stock and expiry experience · Build …` identifies the deployed
frontend revision. Vercel uses its provided commit SHA; local builds fall back
to Git metadata or `development` when unavailable.

## Backend and production follow-ups

- Agree a shared eligibility policy for planner shopping and confirmed-stock
  allocation, including unpaid requests and incomplete schedules.
- Check ingredient review deadlines against the first uncovered forecast date.
  The forecast trace supplies dated gaps, while `urgent_by` can still reflect
  confirmed-only stock evidence. Deadline changes belong in the backend contract.
- A reserved rescue schedule, targeted promotion execution and a shared decision
  log require backend support. Existing frontend worksheets do not implement
  these operations.
- Evaluate real kitchen delivery history and purchasing/waste costs before
  accepting a forecast method for production. Generated records and numerical
  backtests do not establish real customer accuracy or calibrated intervals.
- Verify the deployment branch, successful Vercel build and production alias.
  An immutable deployment URL is not evidence that current main/integration code
  is being served.

No model, database record, recipe, payment or stock quantity was changed by this
UI review. Isolated browser fixtures test interactions; they are not live API or
production database verification.

## Validation

- Full Django application suite: 308 tests run, four skipped, no failures.
- Frontend default, predictive, UX, planner and checkout suites passed; production
  build passed. The existing large-bundle advisory remains.
- Targeted ESLint checks for the shared components, navigation helpers and Vite
  build configuration passed, as did Git whitespace checks.
- Browser checks covered all five Genpact steps and both sources' decision,
  inventory and forecast views at 320, 390 and 1365 pixels (18 combinations),
  without document horizontal overflow or uncaught page errors.
- Kitchen ingredient selection survived the assistant → fridge → planner →
  assistant hand-off. Planner material focus, show-all, empty inventory filters
  and normal-weight 15px summary text were verified with isolated fixtures.
- Build metadata was checked with an explicit deployment commit SHA. Deployment
  promotion and live database/API behavior were not verified.
