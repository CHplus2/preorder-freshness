# FreshCast: kitchen demand to a reviewable decision

## User and problem

The user is the home-kitchen owner deciding what to buy, prepare or promote
before an ingredient expires. The problem is buying speculatively while missing
dated commitments or overlooking surplus. FreshCast combines the owner's own
sales, recipes, batches and schedule; Genpact remains a separate demonstration.

## What is integrated

- The same five-stage journey as the external-data version: spot, explain,
  explore purchasing/preparation/marketing, compare, and review.
- The kitchen illustration, crate view, ingredient selector, priority/waste/
  shortage lenses, review pins, verification checklist and downloadable slip.
- Per-menu daily forecasts projected through **current** recipe quantities into
  **actual recorded** receipt/expiry-dated stock, in native g/kg/ml/l/unit units.
- Confirmed recipe snapshots and preparation dates remain authoritative for
  existing orders. Existing booked portions are subtracted before forecasting
  additional ingredient needs. Stock is allocated once, in expiry order.
- Shopping/date and ingredient context reaches Planner; Inventory opens with
  the ingredient filter; offer settings open their promotion section. These
  handoffs never auto-buy, reschedule a customer, deduct stock or send marketing.
- Purchase what-ifs show both confirmed and additional-demand results. A late
  purchase cannot resolve an earlier need. Overbuying can increase expiry risk.
- Marketing what-ifs use explicitly entered response, discount and campaign
  cost. They cap assumed use at projected surplus and retain unknown menu costs.
  They do not claim to predict conversion or causal uplift.

## Independent local forecasting

`GET /api/admin/predictive/local-decisions/?horizon_days=7` reads the kitchen
database and does not load Genpact CSVs, CatBoost or external model artifacts.
The operational contract is the existing local plan plus `decision_support`.
`GET local-plan/` and the Genpact endpoints remain compatible.

For each active, identifiable menu, use up to 112 completed local delivery days
of paid delivered portions. Missing delivery dates are marked preorder-date
fallbacks. Renamed historical menu identities and removed products are excluded
instead of mapping them by guesswork. Missing dates in the observed span are
zero **recorded sales**; recording coverage is not verified.

Start with the trailing 28-day mean. At 42 observed calendar days, reserve the
preceding 14 days for validation and the latest 14 for testing, leaving at least
14 training days. Compare 28-day mean, 7-day mean and same-weekday mean of up to
four previous weeks. Select on validation MAE only. Report all methods' test MAE
and WAPE; WAPE is null for zero actual volume. Test evaluation is rolling one-day
ahead, using only previous observations. Future multi-day forecasts recursively
use earlier predictions. No history returns a null forecast, not zero demand.

Additional expected portions obey delivery weekdays, daily capacity and earliest
new-order dates from the menu's lead time. A weekly aggregate forecast alone is
not used to invent ingredient or menu identities.

## False alarms and uncertainty

Confirmed stock gaps remain distinct from speculative shortages. Forecast waste
signals require at least seven selling days, a completed evaluation with nonzero
test sales and test WAPE at most 75%, mapped recipes, no excluded active orders
and no excluded historical menu identities. This threshold is a conservative
review policy, not a measured false-positive rate.

Menus whose history contains estimated delivery dates are kept at limited
confidence even when their numerical backtest looks good. The forecast page's
held-out replay plots actual and predicted daily portions and compares all three
baselines on the same test dates.

Low/high demand scenarios vary daily need by held-out MAE; sparse history uses
the forecast itself as a sensitivity amount. These are not calibrated prediction
intervals. Stronger waste signals require surplus even under the higher-demand
case. Incomplete evidence becomes a **review**, defaulting to monitor/verify,
rather than a confident waste alert. Unknown cost stays unknown. Mixed physical
units are never ranked against each other.

Forecast stock use conservatively requires expiry through the delivery day.
This can overstate exposure when earlier safe preparation is possible; Planner
must verify that alternative. Batch expiry and forecasts never establish food
safety. Actual stock condition, lead times, supplier prices, capacity and recipe
identity still require owner review.

## Evidence and impact

Step 5 obtains a fresh, server-signed snapshot using `POST local-reviews/`.
The snapshot contains ingredient/batch/menu IDs, baseline risk, model evaluation,
date, action and explicit worksheet assumptions; no customer data is included.
Up to 20 reviews and editable follow-up notes are held in **this browser**.
Download a slip with its signed review; the follow-up panel can restore that
file after checking the signature. Signing out, switching accounts or clearing
browser storage removes reviews and notes. A same-account reload retains them.
Download slips before signing out; keep those files privately.
Signatures expire after one year and depend on the deployment's signing key.
This is deliberately not a shared server audit log and needs no schema migration.

`POST local-review-outcomes/` verifies the signed snapshot and reads subsequent
waste records for its exact batches plus calendar-day paid delivered portions
for its mapped menus, up to the review date. Actual waste is recorded in the
existing Sales -> Costs, wastage and pricing workflow; a decision save itself
does not write an expense, waste, stock or order record.

For a showcase, demonstrate:

1. A date-specific gap or surplus and its recipe/batch evidence.
2. The chosen baseline's held-out error beside alternatives.
3. A purchase comparison that covers a gap or exposes an overbuy.
4. A marketing worksheet with realistic assumptions and unknown costs retained.
5. A contextual handoff to the actual workflow and a signed decision slip.
6. A later review of **recorded** fulfilled portions and waste, with an owner note.

Reduced projected exposure is a scenario, not proven savings. No waste records
does not establish no waste. Proving impact requires complete logging and a
prospective pilot: compare matched operating periods, recording purchases,
fulfilled portions, shortages, expiry waste, action spend and confounders.
Do not attribute sales or waste changes to an action without a defensible
counterfactual. The UI makes these distinctions explicit.

## Verification and release

`myapp.test_kitchen_decisions` uses isolated, explicitly synthetic fixtures for
selection leakage, sparse/noisy history, FEFO timing, no double-counting, recipe
identity changes, scenario nonpersistence, permissions/CSRF, signed snapshot
tampering and recorded-waste follow-up. Frontend tests cover native-unit links,
financial assumptions, unknown costs, storage failures and signed slip exports.
These algorithm checks are not accuracy results for the owner's business.

No new migration or production data rewrite is required. Runtime evaluations
use the database configured for that deployment. A populated business database
is required before reporting real kitchen accuracy or realised impact.
