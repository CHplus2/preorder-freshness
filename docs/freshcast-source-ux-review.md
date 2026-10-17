# FreshCast source experience review

FreshCast has two business data sources and one sample-data mode. Kitchen and
Genpact should share navigation and decision semantics; identical charts would
misrepresent their different evidence. Sample data is a developer/demo tool,
not a third trained predictor.

## Findings and changes

| Finding | Result |
| --- | --- |
| Three equal source choices made fixtures look like another business dataset. | The normal selector offers kitchen and Genpact. Sample data is entered explicitly from Demo & technical tools; an active sample mode stays labelled and can be exited through the selector. Existing `source=demo` links still work. |
| Genpact hid essential center, horizon and scenario controls behind a disclosure. | Controls stay visible, with the same planning-window and refresh language used for kitchen. |
| Genpact inventory always began with a separate fictional chicken-rescue exercise, including during API failure. | Normal inventory starts with the selected source's stock. The illustrative tutorial remains available only on explicit request in demo tools, for every source. |
| Fixture metrics resembled evaluated model scores despite warnings. | Sample mode does not display the model-evaluation tab. Its notice, captions and comparison labels consistently say sample data/no model run. |
| Genpact Step 4 showed promotion outputs even after selecting purchasing or preparation. | Those actions show the baseline and an explicitly uncalculated outcome. Only promotion selection displays returned promotion comparisons. Hypothetical finance remains optional and separate. |
| A promotion-only inventory problem could lead to a different baseline ingredient. | Explicit ingredient selection is preserved even when the baseline reports no risk. The baseline state is labelled rather than silently selecting a different ingredient. |
| Each explanatory bullet group became another accordion. | Shared evidence tabs group stock, menus, bookings, methods and notes. Primary summaries stay visible; supporting evidence has one entry point per context. Tab keys, arrow keys, Home/End, focus and panel relationships are supported. |
| Manager queues distracted from early decision steps. | Queue/follow-up tools appear at the final review stage in both decision journeys. |
| Inventory selection and layout differed unnecessarily. | All modes have ingredient selectors, business filters and the same planning-fridge family. External stock uses a responsive fridge/inspector layout; weekly replay remains a separate full-width explanation. |
| A large meal response could create an unbounded ticket row. | External forecast tickets are paginated in groups of six while retaining the full meal filter. |

## Differences retained deliberately

| Experience | Kitchen | Genpact | Sample data |
| --- | --- | --- | --- |
| Demand | Daily menu estimates constrained by delivery days, lead time, capacity and recorded orders. | One returned forecast week for external meals and fulfillment centers. | Fixed examples shaped like the external API; no model execution. |
| History and uncertainty | Available per-menu history, held-out comparisons and clearly labelled sensitivity assumptions. | API v1 supplies no meal-level historical series or calibrated uncertainty bounds. | No real performance claim; example metric placeholders are not shown as evaluation. |
| Inventory | Recorded batches, dates and native material units, including labelled fictional seeds. | Simulated recipes, stock/costs and weekly expiry buckets. | Illustrative responses only. |
| Actions | Dated purchase resimulation, manager-entered marketing assumptions and operational planner/inventory handoffs. | Observational promotion-flag comparison; no verified local recipe mapping or adjusted-purchase/schedule outcome. | Rehearsal of the same external UI; no transactions. |

An API failure remains a visible failure. Neither sample data nor the tutorial
is substituted automatically. Supporting tabs mount only their selected content,
so optional whole-store weekly evidence is not fetched just to render the main
decision page. Complete calculation notes remain accessible rather than being
deleted to make the screen shorter.

## Validation and scope

- Existing frontend suites and production build; source-selector, tab structure,
  action-outcome and ingredient-selection regression assertions.
- Browser review of three modes × three views × 320/390/1365px: 27 layout
  combinations, all five decision steps, ingredient/meal selectors, pagination,
  promotion requests, evidence tabs and keyboard focus.
- Explicit sample entry/exit, no predictive API/model calls in sample mode,
  tutorial opt-in, visible API failure/empty states and no silent sample fallback.
- Browser responses for kitchen and Genpact are isolated API-shaped fixtures.
  This validates UI behavior, not deployed API availability or model accuracy.

No backend algorithm, database record, API field name or e-commerce transaction
behavior is changed. Real customer accuracy and Vercel production rollout are
outside this local UI verification.
