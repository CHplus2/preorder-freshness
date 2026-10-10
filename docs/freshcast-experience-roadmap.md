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
