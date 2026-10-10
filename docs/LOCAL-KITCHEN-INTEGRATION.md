# Local kitchen planning: backend implemented, UI handoff

## What works

The integration branch implements staff-only
`GET /api/admin/predictive/local-plan/?horizon_days=7`.
It reads paid pending/processing preorders with reviewed future preparation
dates, accepted order recipes and dated database inventory. It calculates
ingredient requirements, advisory FEFO allocations, uncovered quantities and
unused stock approaching expiry, then gives ordered explanations and actions.
Every request reads the database. It never changes stock, orders or purchases.
It does not load Genpact, the failed local candidate or any ML dependencies.

The authoritative JSON contract is
[predictive-api-contract.md](predictive-api-contract.md#local-kitchen-planning-endpoint).
The original five Genpact endpoints remain a separate evaluated ML demonstration.

## Teammate frontend handoff

No React files were changed in this task. The current FreshCast Decision Assistant
still calls the Genpact endpoints; **it does not yet render this local mode**.
The current response validator only accepts Genpact/simulated source fields.

1. Add an explicit **My kitchen — confirmed orders** choice beside the separately
   labelled **Genpact forecast demo**. Reuse existing staff authentication.
2. Call `local-plan/` with session credentials and a 1–28 day window. No center or
   Genpact week selectors apply to this mode. Use a separate response validator.
3. Display the returned units. Local quantities may be g, kg, ml, l or unit;
   do not append kg to every quantity. Keep nullable costs unknown.
4. Feed the Detect → Categorize → Prioritize → Explain → Decide journey with
   `ingredient_risks`/`recommendations`, retaining the database material IDs.
   Show the known requirement, eligible stock, allocations and uncovered quantity.
5. Make `coverage`, exclusions and source warnings visible. Missing schedules
   or recipes require review in the existing order/planner workflows. Do not
   present no included orders as no demand or no business risk.
6. Disable Genpact promotion what-if in local mode. No local action simulator is
   implemented; a hypothetical worksheet must remain explicitly hypothetical.
7. Refresh or refetch after a user changes an order, recipe commitment or stock.
   There is no push subscription or automatic polling requirement in this API.

The first local demo should use an owner-reviewed, paid upcoming order and its
accepted recipe, plus correctly dated usable batches. Demonstrate both a dated
shortfall and eligible leftover stock approaching expiry. Historical orders
without preparation dates cannot be safely scheduled by this endpoint. Do not
backdate orders or create training history to imply genuine demand observations.

## Model/data strategy

The local aggregate booking experiment actually trained CatBoost but failed to
beat a four-week average (173.23% vs 172.22% holdout WAPE). Only six of 25 weeks
contain recorded bookings and the four test weeks total nine portions. There is
insufficient evidence to call a more complex model better or to claim reliable
per-menu forecasting. Linking recipes improves ingredient calculations; it
does not increase the amount or representativeness of historical demand data.

Collect additional dated, consistently recorded orders for unchanged menu
identities, recording cancellations and availability/sold-out periods. Use known
preorders separately from estimates of additional unbooked demand. Evaluate
chronologically against simple local baselines with more than one meaningful
validation window. Select a learned model only if it improves those baselines.
Avoid tuning against the same small holdout repeatedly.

Generated test orders can exercise an application, but they teach a model the
generator's assumptions and do not establish real shop accuracy. Another public
dataset can provide an external benchmark; similar names/categories do not make
its meal IDs or demand patterns the owner's products. Do not apply the Genpact
model to store order IDs or relabel its results as local predictions.

For pitching, show the evaluated Genpact model as external ML evidence and the
local kitchen mode as known-booking inventory decisions. Keep those claims
separate. The rubric's from-scratch/24-hour reuse eligibility still needs checking;
do not imply the existing FYP was wholly built during the sprint.

## Validation and availability

The isolated Django tests cover staff sessions, invalid parameters/methods,
accepted recipe preservation, compatible unit conversion, whole-order recipe
exclusions, FEFO without double allocation, expiry and shortage together,
quarantine/expired/future receipt exclusions, unknown costs, model independence
and SELECT-only request queries. Run using the repository's safe local Django
settings, never production settings or a production test database.

This code must reach a successful deployment before the public Vercel URL exposes
it. Pushing a commit is not deployment verification. UI integration remains a
teammate task; no public local-mode or accuracy claim follows from backend tests.
