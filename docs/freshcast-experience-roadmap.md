# FreshCast living kitchen — incremental delivery

Direction: an original cozy 2.5D kitchen, inspired by the approachable management interactions in the user's Minami Lane/Kairosoft/virtual-store reference. Keep the existing React/Vite admin routes, API v1 adapter, e-commerce functionality, and the teammate's single backend forecasting model.

## Batch 1 — connected restaurant stations

Implemented: replace generic tabs with illustrated Kitchen, Fridge & stock room, and Order counter stations. Each links to the existing decision, inventory, or demand route while preserving URL context. Active station is marked; counts use the returned baseline response. Loading/error/empty states show unavailable evidence rather than fabricated activity. Decorative art and steam motion are original and respect reduced motion. Existing kitchen hotspots, fridge inspection, forecast tickets, manager rehearsal, and decision slips remain intact.

Validation: frontend build and existing tests, predictive tests, changed-file lint, and contract-fixture browser checks for station navigation, active state, counts, selection retention, errors, and mobile overflow. This does not establish Vercel deployment or live backend readiness.

## Batch 2 — evidence playback (planned)

Add a short, controllable playback of the returned weekly demand and hypothetical FEFO allocations. Animate consumption and remaining stock using returned quantities; provide play/pause/restart and a textual equivalent. Clearly distinguish decorative service activity from forecasted orders and from recorded transactions. No individual customer arrivals, intraday curves, daily forecasts, daily expiry deadlines, or new action effects can be inferred from v1. Keep the playback useful for explaining allocation, with a static reduced-motion view.

## Batch 3 — action outcomes (requires agreed backend outputs)

Connect action-specific before/after estimates when the teammate's backend supplies them. Needed: verified local meal-to-ingredient mappings; supported action parameters and constraints; comparable waste/shortage/purchasing-cost/revenue/profit outcomes with provenance, assumptions and any available uncertainty. Promotion flags currently yield observational scenarios; they do not prove discount or bundle effectiveness. Never display invented confidence intervals, guaranteed savings or causal promotion effects.

Purchasing/preparation outcomes are not supplied by API v1. Discuss any new API fields with the backend developer before changing the agreed contract. A local rehearsal stays explicitly hypothetical. Previewing is separate from applying: do not execute purchases, promotions, messages, or real stock changes through the existing demo.

## Delivery rules

Stay on `feature/ai-dashboard`. Test each implemented batch, commit relevant frontend/docs files, and push that branch. Do not push main, automatically merge, force-push, alter backend/ML logic, train another model, or commit secrets/generated files. Production integration and deployment remain separate actions. Reuse the current checkout and do not create a worktree unless requested.
