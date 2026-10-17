# Kitchen FreshCast audit — 17 October 2026

Scope: kitchen sales forecasting, decision steps 1–5, inventory evidence,
purchase and marketing worksheets, planner hand-offs, saved reviews and outcome
reporting. This is repository and isolated-test verification, not inspection of
the deployed Supabase database or confirmation of a Vercel deployment.

## Findings and changes in this batch

| Finding | Resolution |
| --- | --- |
| Step 1 showed forecast-adjusted waste, but Step 2 led with confirmed-only stock leftovers. | Lead with expiring lots and their exact opening − confirmed − forecast-use = unused calculation. Keep confirmed-only and whole-stock views under labeled disclosures. |
| Whole-window stock minus whole-window demand looked like waste, even when stock expires on different dates. | Show each expiring lot, dated forecast allocation and unused remainder before later-dated carry stock. A menu → recipe → daily ingredient-demand trace explains the FEFO input. |
| The sensitivity range could be read as a confidence interval. | Replace the headline range with explicit lower-demand, central and higher-demand waste outcomes; disclose per-menu shifts and the heuristic formula. No probability claim. |
| One-day test scores were presented alongside multi-day planning forecasts without a matching replay. | Add full-horizon recursive replay on held-out dates. No sales inside a replay window are visible to that forecast. A 28-day horizon does not fit the 14-day test and is explicitly unvalidated. |
| Generated history could still support a strong forecast-waste signal. | Suppress that signal for mapped synthetic history and fictional stock. Numerical backtests remain visible with provenance. Confirmed stock gaps remain visible. |
| Inventory/planner return links discarded the selected horizon. | Carry the selected horizon through the round trip and open shopping at the ingredient review deadline rather than automatically at the end of the window. |
| A purchase comparison used a stale pre-refresh waste cost in one row. | Read that row from the same refreshed baseline snapshot as the other comparison rows. |
| Inventory showed sensitivity without interpreting it. | Label it as what-if outcomes and reuse the expiry calculation evidence for the selected ingredient. |

## Verified design and operational boundaries

- History uses paid, delivered portions grouped by local delivery date. Missing
  delivery dates use an explicit creation-date fallback, which limits confidence.
  Archived/renamed menus are not silently mapped to active local recipes.
- Additional demand is constrained by delivery days, lead time, daily portion
  limits and recorded-order offsets. Some offsets include unpaid requests to
  avoid adding their portions again. They are not confirmed stock commitments.
- Confirmed stock planning uses accepted recipe snapshots, reviewed preparation
  dates and eligible undeducted stock. Future demand uses current menu recipes
  and delivery dates conservatively, without pretending to be a kitchen schedule.
- Forecast allocations use earliest eligible expiry first. Actual ingredient
  deduction uses FEFO when an order is marked cooked; shortage rolls back the
  transaction. Checkout and forecast refresh do not deduct stock.
- Projected waste counts only eligible stock expiring within the inclusive
  planning window. Later-expiring unused stock carries forward. A dated shortage
  can coexist with unused stock that expires before demand arrives.
- Hypothetical purchases recompute baseline and scenario against shared source
  snapshots without persistent stock or order writes. Costs can be unknown.
- Marketing uplift is entered by the manager, not predicted. The existing offer
  settings are storewide; a worksheet does not execute a targeted rescue offer.
- Reviews are signed by the server but stored in the browser. They are not a
  shared operational audit log. Recorded outcomes are observational; they do not
  establish causal savings or verify that missing waste records mean zero waste.

## Remaining limitations before a production claim

1. The displayed 46.22% WAPE is substantial relative error on the supplied test
   records, not a 53.78% accuracy score. A 28-day average may win among the three
   current baselines on validation; that does not prove it is the best forecasting
   model. Synthetic records cannot resolve real model choice. Evaluate genuine
   delivery-date history, simple baseline improvement and operational under/over-
   purchasing costs before choosing a more complex model with the backend owner.
2. The 112-day calendar window fills absent dates with zero recorded sales.
   Missing records, kitchen closures, stockouts and true zero demand are not
   reliably distinguished. This is a data-coverage limitation.
3. The whole-store weekly forecast and per-active-menu decision forecasts are
   different targets. Weekly totals can include archived products and cover a
   calendar week; they need not equal active-menu totals for a rolling horizon.
4. The planner's shopping endpoint and FreshCast confirmed-stock planning have
   different order eligibility rules. The planner can include unpaid/schedule-
   incomplete requests; FreshCast excludes them from confirmed stock allocation.
   Ingredient context is displayed on the planner, but shopping is not filtered
   to only that material. These surfaces must not be presented as one identical
   committed purchasing ledger without a backend eligibility decision.
5. A speculative demand date is not a reserved preparation task. The scheduler
   must still validate worker/equipment capacity, holding times and existing
   bookings. No automatic rescue schedule, promotion or purchasing execution is
   implemented. Financial worksheet outcomes are assumptions.
6. Automatic supplier lead times, calibrated prediction intervals, real customer
   model validation and a shared decision/outcome log remain unavailable.
7. Live database reconciliation, production deployment and browser interactions
   against the deployed application remain unverified by this cloud audit.

The next design batch should compare Genpact and kitchen flows using these
boundaries. Share the expiry-first narrative, scene interactions and decision
navigation while preserving each source's provenance, forecast target and
available operational actions. Do not claim complete production integration yet.

## Validation for this batch

- Full Django application suite: 307 tests run, 4 skipped, no failures, using
  isolated SQLite with dotenv disabled. Supabase was not modified.
- Frontend utility, product UX, escrow UI state, planner, checkout and predictive
  checks passed; production Vite build passed. Existing main-bundle size warning
  remains. React rendering checks ran with local test-server socket access.
- Added regression coverage for recursive horizon replay without within-window
  leakage, unvalidated long horizons, generated-history/stock signal suppression,
  expiry and daily recipe ledger conservation, expiry-first Step 2 rendering,
  horizon-preserving links, malformed evaluation metadata, and refreshed
  purchase-comparison costs.
