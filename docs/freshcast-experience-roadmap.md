# FreshCast living kitchen — incremental delivery

Direction: an original cozy 2.5D kitchen, inspired by the approachable management interactions in the user's Minami Lane/Kairosoft/virtual-store reference. Keep the existing React/Vite admin routes, API v1 adapter, e-commerce functionality, and the teammate's single backend forecasting model.

## Batch 1 — connected restaurant stations

Implemented: replace generic tabs with illustrated Kitchen, Fridge & stock room, and Order counter stations. Each links to the existing decision, inventory, or demand route while preserving URL context. Active station is marked; counts use the returned baseline response. Loading/error/empty states show unavailable evidence rather than fabricated activity. Decorative art and steam motion are original and respect reduced motion. Existing kitchen hotspots, fridge inspection, forecast tickets, manager rehearsal, and decision slips remain intact.

Validation: frontend build and existing tests, predictive tests, changed-file lint, and contract-fixture browser checks for station navigation, active state, counts, selection retention, errors, and mobile overflow. This does not establish Vercel deployment or live backend readiness.

## Batch 2 — evidence playback (implemented)

Implemented in Inventory evidence: a four-stage weekly replay of demand, batch eligibility, returned allocation, and waste/shortage outcomes. Play/pause/restart, manual stage selection and Next controls reveal existing API results without recalculating FEFO or interpolating stock through fictional time. Batch trails are scoped to the selected ingredient and sorted by expiry; excluded batches remain identified. Missing evidence stays unavailable and zero results stay zero. A static final view is the reduced-motion default, with manual navigation still available. Changing ingredient or response context resets playback.

Illustrated package/bowl transfer and allocation bar reveals are decorative explanations, not customer arrivals or recorded transactions. No daily curves, deadlines, action effects, revenue or profit are inferred. Center-wide returned meal forecasts are summed as such; they are not treated as verified orders for the selected ingredient. Exact full batch tables remain available below. Validation includes 18 predictive tests, frontend tests/build/lint, plus browser pause/restart/reduced-motion/missing-data and mobile checks using contract fixtures. Live backend and Vercel deployment remain separate validation.

## Batch 3 — action outcomes (requires agreed backend outputs)

Connect action-specific before/after estimates when the teammate's backend supplies them. Needed: verified local meal-to-ingredient mappings; supported action parameters and constraints; comparable waste/shortage/purchasing-cost/revenue/profit outcomes with provenance, assumptions and any available uncertainty. Promotion flags currently yield observational scenarios; they do not prove discount or bundle effectiveness. Never display invented confidence intervals, guaranteed savings or causal promotion effects.

Purchasing/preparation outcomes are not supplied by API v1. Discuss any new API fields with the backend developer before changing the agreed contract. A local rehearsal stays explicitly hypothetical. Previewing is separate from applying: do not execute purchases, promotions, messages, or real stock changes through the existing demo.

## Delivery rules

Stay on `feature/ai-dashboard`. Test each implemented batch, commit relevant frontend/docs files, and push that branch. Do not push main, automatically merge, force-push, alter backend/ML logic, train another model, or commit secrets/generated files. Production integration and deployment remain separate actions. Reuse the current checkout and do not create a worktree unless requested.

Batch 3 frontend increment: added an interactive decision workbench in Compare tradeoffs, with baseline/promotion inspection, signed outcome differences, independent quantity/cost bars, explicit missing evidence, and expandable action capabilities. Exact API tables and the separate hypothetical worksheet remain available. Backend `ac967c2` still lacks action-specific purchasing/menu financial outcomes; see `predictive-action-outcomes-request.md` for the proposed extension. This increment does not complete the backend-dependent action simulator.

## Batch 4 — kitchen review queue

Added an ephemeral manager planning board on the decision route. Pin the selected ingredient issue, inspect the next unqueued issue in backend priority order, reopen evidence, remove tickets or clear the board. Tickets preserve baseline guidance and waste/shortage evidence, labeled draft and simulated/fixture. No invented completion score, realized savings, persisted approvals or backend writes. Changing forecast contents/source or leaving/reloading the decision view clears the queue; selecting ingredients keeps it. Existing downloadable per-ingredient brief remains available in the final decision step.

Batch 4 validation: all 18 predictive tests and existing frontend/UX/planner/checkout suites passed, along with the production build and changed-file lint. Fixture browser checks passed for duplicate prevention, next-issue navigation, reopen/remove/clear, page-reload reset, mobile overflow and zero API writes. Live backend and production deployment were not verified.

## Batch 5 — visual risk tradeoffs

Added a waste/shortage map to the action comparison workbench. A circle marks baseline and a diamond marks the returned promotion scenario; axes use ingredient-specific independent kg scales, with exact quantities in accessible SVG text. A plain-language summary calls out opposing waste/shortage movements rather than declaring a winner. Missing scenarios remain unavailable; overlapping points and zero values are explained. No cost estimates, confidence intervals, causal effects or action execution are inferred.

Batch 5 validation: 21 predictive tests, existing frontend/UX/planner/checkout suites, build and changed-file lint passed. Fixture browser checks passed for unavailable scenarios, baseline/promotion switching, accessible map quantities, unknown costs and mobile overflow; desktop screenshot reviewed. Live backend and Vercel deployment remain unverified.

## Batch 6 — manager verification and handoff

Final recommendation now has an interactive three-item checklist for reviewing real batches/handling, recipes/mapping, and suppliers, plus an optional manager note. Marks remain self-reported and do not imply system verification, approval, food safety or action execution. Downloaded drafts include manual review status and user-entered notes separately from backend guidance. Local review state resets on ingredient/source/forecast changes or reload, with no storage or API writes.

Batch 6 validation: 23 predictive tests, existing frontend/UX/planner/checkout suites, build and changed-file lint passed. Fixture browser checks covered checklist interaction, draft-download content and labels, within-ingredient navigation retention, reload reset, mobile overflow and zero API writes. Live backend and Vercel deployment were not verified.

## Batch 7 — kitchen risk lens

Managers can switch between the default backend priority order, waste-first quantities and shortage-first quantities. The selected lens opens the leading issue, persists as URL context, reorders the scene/list and next-issue queue navigation, and keeps every issue available. Equal quantities preserve backend order. Unknown costs remain unknown; quantity ordering is explicitly a viewing preference, not a new recommendation. Review queue tickets survive lens changes; switching the selected ingredient starts its own review state. No model reruns or API writes are triggered.

Validation: 26 predictive tests, existing frontend/UX/planner/checkout suites, build and changed-file lint passed. Fixture browser checks passed for focus selection, backend default, queue retention, mobile overflow and zero API writes. Live backend and production deployment remain unverified.

## Batch 8 — return to the visual kitchen

Refocused the decision route on the original isometric kitchen. Risk-lens controls and the manager review queue are collapsed secondary panels. Clickable hotspots now include illustrated ingredient packages and explicit waste/shortage labels; the selected inspection panel shows matching package artwork and separate returned waste/shortfall quantities. Added decorative window/lantern details without representing live activity. Selecting a problem from another control resets the kitchen preview to that ingredient and starts on its correct hotspot page. Artwork remains illustrative, not verified storage, recipe mapping or actual stock.

Validation: 26 predictive tests, existing frontend/UX/planner/checkout suites, production build and changed-file lint passed. Fixture browser checks covered collapsed controls, marker preview, decision handoff, reopening queue/focus controls and mobile overflow. Desktop/mobile screenshots reviewed; live backend and Vercel production were not verified.

## Batch 9 — visual stock versus need inspection

Kitchen inspection now compares returned eligible-stock and forecast-need kilograms using two decorative containers on a common scale. Native buttons select a short explanation, while source/interpretation details stay collapsed. Selecting another ingredient resets inspection. The component never subtracts these values to invent waste or shortage; those remain separate backend results. Wider desktop inspection improves readability; no new standalone section or model was added.

Validation: 26 predictive tests, existing frontend/UX/planner/checkout suites, build and changed-file lint passed. Fixture browser checks covered exact quantities, selected explanations, ingredient reset, mobile overflow and zero API writes; component screenshot reviewed. Live backend and production deployment remain unverified.

## Batch 10 — navigation inside the kitchen

The illustrated drawing now has its own fixed aspect-ratio stage, independent of inspection-panel height, so hotspot positions stay aligned with the room. Fridge and Order counter links are placed on the artwork and use native accessible navigation to existing routes. Fridge preserves the locally inspected ingredient and source/center/scenario context; Order counter clears a meal filter to show all returned external meal forecasts without implying a local recipe mapping. Ingredient positions remain decorative. Title/caption sit outside the drawing to reduce marker overlap.

Validation: 26 predictive tests, existing frontend/UX/planner/checkout suites, build and changed-file lint passed. Fixture browser checks covered stable stage aspect ratio, preview-to-inventory context, keyboard demand navigation, mobile click targets and overflow. Desktop/mobile screenshots reviewed. Live backend and Vercel production remain unverified.

## Batch 11 — illustrative chicken rescue story

Inventory now offers an explicitly launched, standalone fictional rescue demo, available even when API evidence is unavailable. Open a closed planning fridge and inspect chicken, choose original menu/20% special/bundle, play or pause an illustrative shift, restart or show the assumed result. An original decorative customer moves while portion markers reveal preset sales totals. Reduced motion shows the final result directly and disables animation. The existing API inventory remains separate and is never substituted with this example.

Every story outcome is authored, not AI/model output: 20 portions, sales 11/16/18, prices RM 10/8/12, stock cost RM 4 per portion, special setup RM 8, bundle sides RM 2 per sale/setup RM 12. Financial outputs are illustrative revenue, remaining-stock exposure and contribution excluding overhead; no net-profit claim. Sales ±2 is an explicitly assumed sensitivity range, not model uncertainty. The bundle suggestion is attributed to the authored scenario. Tomorrow is fictional, not inferred from weekly expiry. No promotions, orders or stock writes occur.

Validation: 26 predictive tests, existing frontend/UX/planner/checkout suites, build and changed-file lint passed. Fixture browser checks covered fridge opening/inspection, action changes, pause/restart, baseline/bundle outcome arithmetic, reduced motion, mobile overflow and zero API writes. Screenshot reviewed. Production deployment and live backend were not verified.

## Batch 12 — miniature serving scene and outcome comparison

Replaced the demo's dot-based playback with an original illustrated restaurant: awning, lanterns, chef, serving counter, twenty plates and decorative customers. Preset sales empty the plates; customers animate only during playback and stay static under reduced motion. The final outcome board compares original and selected plans on a common twenty-portion scale, with illustrative revenue and contribution labels. It preserves all Batch 11 source/assumption disclosures and adds no model, endpoint, transaction or causal claim.

Validation: 26 predictive tests, existing frontend/UX/planner/checkout suites, build and changed-file lint passed. Fixture browser checks passed for fridge/action flow, pause/restart, baseline/bundle quantities and contribution arithmetic, reduced motion, mobile overflow and zero API writes. Updated screenshot reviewed; live backend and production deployment remain unverified.

## Batch 13 — focused rescue-story stages

Rescue demo now progresses through fridge inspection, action choice, a full-width illustrated shift and a compact impact reveal. A four-step indicator marks the current stage. Taking a plan to the serving counter hides fridge/action clutter; Try another plan returns to choice and resets playback. Results retain a smaller restaurant illustration alongside the assumed outcomes. Stage-heading focus follows transitions for keyboard/screen-reader users. Source disclosures, hypothetical assumptions and the independent API inventory remain intact.

Validation: 26 predictive tests, existing frontend/UX/planner/checkout suites, build and changed-file lint passed. Updated fixture browser flow passed for staged fridge/action selection, playback pause, baseline/bundle results, retry, restart, reduced motion, mobile overflow and zero API writes. Live backend and Vercel production remain unverified.

## Batch 14 — interactive demand assumptions

The fictional rescue story now includes a keyboard-accessible quieter/busier slider before playback, with an assumed adjustment from -4 to +4 portions. The same offset applies to all authored plans; each sales count is bounded by zero and twenty available portions. Baseline and selected-plan sales, remaining stock, revenue and contribution update consistently. Closing/reopening the story restores the preset assumptions. This is deterministic scenario arithmetic, not an added demand model or a calibrated uncertainty control. Preset assumptions remain disclosed.

Validation: 29 predictive tests including preset arithmetic, shared quieter-demand comparisons, negative contribution and stock bounds; existing frontend/UX/planner/checkout suites, build and changed-file lint passed. Fixture browser checks passed for keyboard slider adjustment, changed bundle/baseline outcomes, pause/restart, reduced motion, mobile overflow and zero API writes. Live backend and production deployment remain unverified.

## Batch 15 — interactive fictional shift receipt

Replaced repeated financial prose in the illustrative rescue result with a receipt. Revenue and expenses share a visual scale; tap stock, sides or setup to inspect the authored cost. It shows signed contribution and difference versus the same-demand baseline. Explicitly explains that remaining-stock exposure is already included in the RM 80 stock cost, so it must not be deducted again. No net-profit, realized savings or model-outcome claim is introduced.

Validation: 29 predictive tests, existing frontend/UX/planner/checkout suites, build and changed-file lint passed. After restarting Vite in the resumed environment, fixture browser checks passed for cost selection, RM 128 bundle expenses, RM 88 contribution and +RM 58 baseline difference, plus fridge/action flow, pause/restart, reduced motion, mobile overflow and zero API writes. Receipt screenshot reviewed. Live backend and Vercel production remain unverified.

## Batch 16 — illustrated rescue menu

Replaced the plain fictional-action radio list with original illustrated menu cards: chicken dish, 20% special and side bundle. Each shows assumed sale price, sales/unsold portions under the current demand offset, and side/setup costs. Cards retain native radio controls and keyboard behavior; the bundle badge explicitly attributes the suggestion to the authored story. Decorative meals do not establish verified product/recipe mappings. The existing storyboard, playback and receipt remain intact.

Validation: 29 predictive tests, existing frontend/UX/planner/checkout suites, production build and changed-file lint passed. After starting Vite, fixture browser checks passed for menu selection, full fridge/playback/receipt flow, pause/restart, reduced motion, mobile overflow and zero API writes. Menu screenshot reviewed. Live backend and production deployment remain unverified.
