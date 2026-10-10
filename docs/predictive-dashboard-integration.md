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

## FreshCast decision assistant

The FreshCast sidebar entry opens `/admin/ai/decisions` as the main demo. It presents a five-step manager journey: choose a baseline waste/shortage issue, read API explanations and quantities, explore purchasing/preparation/promotion actions, compare evidence and tradeoffs, and review the baseline backend recommendation with its reasoning. Charts, full inventory/FEFO tables and model metrics remain in secondary analytics. Kitchen context is expandable on the assistant so the issue takes priority.

Ingredient, step and explored action are retained in URL parameters through a promotion calculation and analytics navigation. Changing the center/source clears them; changing the ingredient starts a new journey. Financial inputs start blank and reset when the calculation remounts or the selected action changes; they are not saved, sent to Django, or written to the URL.

The optional financial worksheet is explicitly hypothetical. With a known baseline potential waste cost, manager-entered total action cost and assumed waste-avoidance percentage, it computes avoided waste cost = baseline cost × assumed percentage, remaining waste cost, and net benefit = avoided waste cost − assumed action cost. It can show negative net benefits; unknown costs and invalid/absent assumptions prevent estimation. It excludes sales revenue, shortage recovery and unspecified costs. It is not a backend action simulation or optimization and never changes the backend recommendation.

Promotion comparisons use actual `what-if/` response fields when available, with CSRF and existing prerequisite/error handling. Preparation/menu prioritization is an option to review, not an automated menu recommendation: verified ingredient-to-local-menu mappings and action-outcome estimates are not supplied by v1. No purchase or promotion is executed. Browser fixture validation exercises the full journey, scenario step retention, blank assumptions, financial estimates, unknown-cost blocking, mobile layout and no-risk/API-error states.

## Illustrated pantry experience

The primary assistant uses an original vector storefront inspired by small Japanese shops and kitchen management games: a striped awning, warm paper/wood colors, shelf scenery, ingredient crates, and a manager’s order slip. The artwork is decorative and contains no external images, inferred recipe mapping, live-store location, or food-safety classification. Packaging selection only changes the illustration; it does not change any operational data.

Crates are keyboard-operable buttons with pressed-state selection. Their risk labels, expiring-unused/shortfall quantities, nullable costs, order and explanation use the baseline API response. Selecting a crate moves focus to the decision counter and restarts that ingredient’s journey. An alternative list view stays available. The scene is responsive, supports reduced motion, and shows an empty briefing after successful no-risk calculations; unavailable APIs remain errors rather than invented store activity. No game score, virtual savings or purchase execution is introduced. API, backend and ML logic remain unchanged.

## Visual clarity review

The pantry now starts with a plain-language waste/shortage summary and a short instruction for the decision journey. The explanation step shows API ingredient demand, eligible stock, and possible waste/shortage on a shared kilogram scale. These are independent quantities, not a stacked total or a new forecast calculation. Step navigation focuses the new heading and respects reduced motion. The recommendation ends with a practical verification checklist. Desktop/mobile browser checks use intercepted contract fixtures; live integration and first-time user testing remain separate validation.

## Typography and interaction refinement

Functional headings and ingredient labels use the system sans-serif; the main headline and shop sign retain serif styling. Crate labels and manager notes are larger, the decorative storefront is shorter, and repeated promotional copy is removed. Full source warnings remain available in a native expandable section, with model/simulated-operation and fixture provenance still visible above the experience.

Crates use CSS perspective and hover depth without a WebGL dependency. Motion is limited to hover-capable devices and respects reduced motion; keyboard selection remains available. The three forecast explanation cards are buttons with pressed states and a politely announced explanation for each stage. They use existing API quantities without additional model calculations or claims about action outcomes. This is visual depth, not a 3D inventory simulation.

## Kitchen hotspot explorer

The assistant now opens on an original isometric SVG kitchen with numbered HTML button hotspots. A marker selects an issue preview locally; “Explore this decision” opens that ingredient’s existing decision journey. Ingredient quantities and nullable costs come from the baseline API response. Marker locations are decorative, with no inference of real storage zones, food handling, or product mappings. This is a perspective illustration with hotspots, not a rotatable 3D scan.

The previous crate experience remains available through the view switch, and the ingredient list remains available below. Six issues appear per kitchen scene, with paging for additional issues. Buttons have accessible names, selected states, and 44px markers; issue previews announce changes politely. Mobile stacks the inspector beneath the scene. No extra model, backend changes, purchase execution, external imagery or WebGL dependencies are introduced.

## Interactive demand and inventory evidence

All three FreshCast views share the illustrated kitchen styling. Demand analytics leads with selectable meal forecast tickets and a baseline/promotion display switch. Switching changes which returned forecast values are displayed; it does not calculate a new scenario or interpolate demand. A selected ticket explains its baseline and returned promotion difference. Unavailable scenario values stay unavailable, and the promotion switch is disabled until a scenario response exists. External meal IDs remain unmapped; no dish names, historical series or confidence intervals are invented.

Inventory evidence leads with ingredient shelf cards, waste/shortage filters, and an inspected ingredient's expiry-sorted batch trail. Batch bars represent consumed versus remaining quantities from the API, with exact values and eligibility displayed. Missing batches and unknown costs stay explicit. Ingredients with both waste and shortage appear in both filters. The decision link carries the selected ingredient and existing context into the baseline decision journey. Original packaging illustrations are decorative. Exact demand, ingredient and batch tables remain available in expandable sections. Hover/bar transitions respect reduced motion; buttons retain keyboard access and pressed states.

## Decision rehearsal and manager briefing

After the manager enters valid optional worksheet assumptions, an interactive rehearsal replaces the static worksheet KPI row. It shows baseline potential waste cost, assumed avoided/remaining waste cost, action cost, and net benefit. A keyboard-operable percentage slider updates the existing manager assumption only; it does not call the model or change the backend recommendation. The view explains negative and zero benefits, break-even assumptions, zero baseline cost, and action costs above the maximum avoidable waste cost. Blank/invalid assumptions and unknown waste costs still prevent estimation. Bars respect reduced motion.

The recommendation can download a plain-text decision slip generated from the currently displayed baseline response. It preserves source metadata, explicit fixture labeling when fixture mode is selected, response warnings, unknown costs, original backend guidance, the explored alternative, and any valid manager assumptions. It includes a verification checklist and states that no action was executed. Downloading is local to the browser; no data is posted, message sent, or purchase placed. Three briefing tests cover provenance/recommendation separation, missing costs, and negative hypothetical benefits. Browser fixture checks exercise the slider at 0/100%, responsive layout, and the actual downloaded file.

## Cozy planning fridge

Inventory evidence now wraps its existing ingredient cards in an original illustrated fridge cabinet. Opening/closing is local presentation state; it never changes inventory. The keyboard-operable door toggle exposes expanded state and controls an identified shelf region. Closed shelves are hidden from interaction and assistive technology. Counts come from the current risk filter, and selected ingredient briefings continue to use API quantities, explanations and batch allocations.

An original kitchen keeper illustration accompanies the inspected ingredient's briefing. It does not represent an AI chat response, customer happiness score, or action outcome. Storage zones and temperatures are not inferred: the fridge is explicitly a planning illustration, including ingredients that may require different actual storage. Open animation respects reduced motion; mobile retains two-column ingredient cards and no page overflow. Existing risk filters, unknown costs, empty states, batch trails, baseline decision links, promotion comparisons and decision slip downloads remain available. No copied game assets, WebGL dependencies, backend/ML changes, or action execution are added.

## Connected restaurant stations — batch 1

The three FreshCast routes now share illustrated station navigation: Kitchen (decision assistant), Fridge & stock room (inventory evidence), and Order counter (demand analytics). Native navigation links preserve source/center/scenario/meal/ingredient/step/action URL context and expose active-page state. Summary counts come from the full baseline response, not a filtered meal view or invented customer activity. All counts are unavailable until successful API loading. Mobile stacks the station cards; optional hover steam respects reduced motion. See `docs/freshcast-experience-roadmap.md` for the staged service-playback and backend action-outcome work.

## Weekly evidence replay — batch 2

Inventory evidence now includes a staged replay of its selected ingredient: demand, eligible/excluded batches, returned consumption allocation, and reported waste/shortage. Autoplay advances explanatory stages only, every 2.2 seconds; it never models elapsed kitchen time or interpolates new quantities. Pause cancels progression, Restart resets to the first stage, and manual stage buttons/Next remain available. The replay shows source/scenario labels and all quantities from the current response. Changing ingredient/context remounts it. No API request or stock change is triggered by playback.

The presentation helper sorts copied ingredient batch rows, sums returned center-wide meal estimates when present, and sums eligible-batch consumption when batch evidence is present. Empty evidence remains unavailable; returned zero results stay zero. API ingredient availability and expiring-unused quantities are used directly, not reconstructed from batch totals. Remaining quantities are not relabeled as waste. Reduced-motion users start with a static result view and can navigate manually; dynamic preference changes stop autoplay. Exact all-batch tables remain available below the interactive inventory view.
