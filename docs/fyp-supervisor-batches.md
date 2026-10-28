# Supervisor feedback batches — 27 October 2026

## Batch 1: menu budget comparison

The date-based menu finder supports within, above, and both budget ranges. It
compares the full requested quantity of one menu, before discounts and excluding
delivery/existing basket items. Cards show unit price × quantity = food total
and the difference from the budget. The browser rejects inconsistent returned
totals or the wrong side of the selected budget. Clearing/changing preferences
invalidates old results; an explicit comparison action can recover from an empty
within-budget search. Date-free recommendations/catalogue browsing remain separate.

The regression reproducing RM35 × 3 with a RM100 budget **passed on the previous
backend**: that menu was excluded. No incorrect production response was available
for inspection. This batch removes ambiguous price presentation and adds explicit
above-budget exploration rather than claiming a reproduced arithmetic bug.

Budget presentation follow-up: results are explicitly alternative purchases of
the requested quantity of one menu. Price filtering was verified to occur before
top-three selection; no incorrect multiplication was reproduced. The finder now
shows the date/category price range before capacity checks and counts within/
above budget, so an empty above-budget search can be explained by the absence
of any qualifying menu price. Tests include an expensive menu absent from the
original top three that is nevertheless returned by Above. No price changes,
combined-basket recommendation, schema change or model retraining is included.
Validation: 52 focused recommendation/preorder tests, frontend lint and unit/UX/
recommendation suites and build, plus 11 desktop/phone accessibility and overflow
checks against a local API fixture. No live email, production data or order was
used in the browser checks.

## Batch 2A: inventory date modes and deadline evidence (completed)

The form now shows the fields needed for printed expiry, manufacture plus
documented duration, or receipt plus documented storage life. Receipt means when
the batch reached the owner; it is not the manufacture date or printed expiry.
Unlabelled batches can use custom documented storage life without an invented
manufacturing date or a raw-material preset. A preview shows the date arithmetic.

Saving preserves the earliest calculated, printed, opened or thawed deadline.
Previously a separately recorded printed limit could be ignored in calculated
modes. Switching a legacy labelled batch to a calculation retains its old printed
deadline when omitted; switching back does not invent a printed date from a
calculation. Unknown handling or a storage breach visibly holds the batch.
Existing stored records are not rewritten: review their evidence on edit.

Recorded status uses Malaysia's date: before today is expired, today through
three days ahead needs attention, and later dates are within the recorded
deadline. A hold overrides these statuses. These are deterministic planning
rules, not random values or physical freshness/safety measurements. No database
migration, production data edit or forecast/model change is needed for 2A.

Use documented, condition-specific general guidance for unlabelled ingredients.
The supplied FoodSafety.gov cold-food storage chart is a reference to review,
not an automatic guarantee for a wet-market batch with unknown prior handling.
Do not invent a manufacturing date. Storage conditions, ingredient state and
actual handling must match the selected guidance. Review source text before
seeding any reusable defaults.

Batch 2A validation: all 745 application tests pass (20 platform-specific skips),
including seven new expiry-evidence regressions; 90 focused PostgreSQL tests
also pass. Frontend lint, UX/recommendation tests and production build pass.
Eleven full-page accessibility/overflow checks at desktop and 390/320 pixels
cover unlabelled receipt-based creation, handling holds, printed/opened limits,
edits and mode switching against a disposable local PostgreSQL database. No
production records or real emails/courier requests were used.

## Batch 2B: optional reusable raw-material guidance (released)

The ingredient directory supports up to one receipt-based reference for each
storage type: chilled, frozen or ambient. Days, a source/document reference and
applicable ingredient state/storage conditions are required for an entry; an
empty list remains valid. No duration is preseeded or claimed to be verified.

A batch offers only the reference matching its actual storage. An explicit
action copies days and evidence into received-date mode, keeping printed caps,
opened/thawed limits and holds. Custom evidence remains editable. Switching the
ingredient clears borrowed date evidence instead of carrying guidance for a
different ingredient. Existing saved batches are not changed by reference edits.

Migration `0023_raw_material_storage_guidance` adds a JSON field defaulting to an
empty list for existing ingredients. The tested Supabase SQL equivalent is in
`deploy/sql/0023_raw_material_storage_guidance.sql`. Follow the
[release instructions](freshcast-storage-guidance-release.md) before publishing
to production; no database password changes are needed. The owner confirmed the
target migration result on 27 October 2026, allowing main and integration to
advance together. This confirmation is owner-reported; live Vercel deployment
health is separate from the completed local release checks.

All 751 application tests pass (20 platform-specific skips). Validation includes
six new API tests for optional guidance, storage separation,
strict input validation, access control, snapshots and source limits, plus 58
focused PostgreSQL tests. Frontend lint, UX/unit suites and production build
pass. Eleven full-page accessibility/overflow checks at 1440, 390 and 320 pixels
exercise UI creation/error recovery, matching-storage copy, printed caps,
multi-storage edits, custom values and ingredient switching. The SQL script was
run twice on an isolated pre-migration PostgreSQL fixture and preserves existing
ingredient rows. No production records, emails or courier requests were used.

## Inventory form follow-up: simpler primary path

The date form now leads with package date, received-date calculation or
manufacture-date calculation. Receipt-based guidance is offered only in the
relevant mode; manual documented input remains available without a preset.
Supplier/cost and opened/thawed/handling fields are collapsed, with recorded
limits indicated and holds visible. Unchanged quantities do not ask for an
adjustment reason. Edit displays one ingredient identity rather than the whole
disabled directory. Best-before wording distinguishes quality from measured
spoilage, while retaining the conservative allocation cutoff.

Changing storage clears old calculation days/source so a frozen reference is not
silently reused for chilled stock. Earlier printed and event limits/holds remain.
The change has no migration or backend rule/model modifications. Validation:
45 focused inventory/reminder tests pass (one PostgreSQL-only skip), frontend
lint, unit/UX suites and production build pass, and ten full-page accessibility/
overflow checks pass at 1440, 390 and 320 pixels. The browser uses local fixture
records for printed, manual/saved receipt, manufacture, stock-adjustment and
earlier-limit paths. No live worker, real email or production record was used.

## Courier automation and reminder verification

Grouped progress and manual courier/WhatsApp contact actions are implemented.
Food-ready eligibility covers pending/processing orders with valid reviewed
preparation boundaries. Courier pickup and actual customer receipt remain
separate events; time passing does not update them.

GrabExpress booking/reference import/webhooks remain pending official regional
API access, as described in [courier readiness](courier-integration-readiness.md).
No sandbox connection is assumed. Email scheduler code/configuration workflow
has been fixed, but a successful scheduled worker execution and actual intended
inbox receipt still require live verification. These tasks are not completed by
this menu-budget batch.

Batch 1 validation: 63 backend recommendation/commitment/preorder tests pass,
including RM35 × 3 excluded from RM100 within-budget searches, strict above-
budget matching, the RM99.99 equality boundary, mixed-range selection, no invented
capacity and bounded scans. Frontend recommendation and checkout suites, lint
and production build pass. Eleven whole-page accessibility/overflow scans pass
at 1440, 768, 390 and 320 pixels. The real local API/browser journey covers all
three modes, empty-result recovery, wrong-total response rejection, clearing
stale results and explicitly adding three above-budget units. No order was placed,
no live worker was called and no real customer data/email/provider was used.


## Mixed whole-order recommendations — 28 October 2026

The owner clarified that RM100 is a whole-order budget and quantity 3 means
three items total, allowing different menus. The date finder now proposes up
to three complete basket alternatives. It includes existing basket items,
current bulk discounts and delivery fees in both quantities and budget checks.
Existing items are preserved; only the remaining quantity is added. Above and
within comparisons happen before the result limit, with equality within budget.

The selected option uses small food photos, unit prices, one explanation per
menu, a shared order breakdown, one common delivery-time selector and one Add
action. This replaces repeated three-unit menu offers and per-menu time buttons.
The catalogue and instant personalised recommendations stay independently usable.

The bounded candidate search checks the entire basket together with the existing
checkout scheduler. It uses up to 12 menus and 30 capacity checks; it does not
promise every possible combination or optimise spending to exhaust a budget.
Application is session-bound, CSRF-protected, atomic and idempotent. Concurrent
or repeated confirmation cannot add the same option twice. Basket/price/rule or
capacity changes require a new search. Adding does not reserve capacity, place
an order, deduct stock or initiate payment/email. No migration or retraining.

Validation: the full backend suite passes 782 tests (22 platform-specific skips);
55 focused PostgreSQL tests also pass, including simultaneous confirmations and
interrupted-write rollback. Frontend lint, unit, checkout, shopping, UX and
recommendation suites pass, with a production build. Local browser checks cover
real mixed additions, existing items, completed/oversized targets, lost-response
recovery, both budget ranges, stale basket rejection, malformed responses and
guest sign-in. Eight full-page WCAG/overflow checks pass across 1440, 390 and
320 pixels, with visual inspection of compact desktop/mobile cards. These checks
use fictional local records only, with external browser requests blocked. No
production customer records, email worker, courier or payment service is used.

Manual acceptance after the deployment is Ready: sign in, start with an empty
basket, enter a future offered date, quantity 3 and budget RM100. Choose one
basket option: the item quantities must sum to 3 and the displayed whole-order
total must match food minus discount plus delivery. Add once, then search again
with target 3: it should offer review rather than another three additions. With
one existing item, the Add action must add only two. Above mode needs a feasible
three-item basket whose complete total is strictly greater than RM100; it should
show no match when no generated basket meets that condition.


## Recommendation-to-checkout handoff — 28 October 2026

The earlier RM36 card was RM12 × 3 units of one menu, not a unit price of RM36.
The user subsequently clarified a preference for three total items allowing a
mix, implemented in the preceding batch. This batch follows that basket choice
through to checkout.

Review found a genuine handoff bug: the recommendation saved a time, but the
basket passed empty navigation state which overrode it at checkout. Delivery
choices now live in one account/basket/fulfilment-scoped context, optionally
persisted for a same-account reload. All three entry points use it. Scope changes,
expired or malformed storage and old navigation history cannot supply a current
choice for a different basket. Account changes clear the stored preference.
Browser-storage failure still permits in-memory navigation with a choice; it
does not promise persistence across a reload.

A selected-time summary and Change time button replace a repeated automatic
search when a choice already exists. Changing quantity or fulfilment rules
requires a fresh check. Checkout still obtains a current quote, and final server
submission retains its capacity/stock checks. Nothing here places an order,
reserves preparation or dispatches a courier. No migration, scheduler change or
forecast retraining is required.

Validation: frontend lint, checkout, recommendation, shopping, unit and UX suites
and production build pass. Focused tests cover Malaysia-time normalization,
invalid/expired values, stable basket ordering, exact account/basket/fulfilment
scope, blocked storage, selected/changed/unavailable display and account clearing.
The real local browser/API journey verifies RM35.50 for three mixed items and an
unchanged selected time from recommendation through basket to checkout, restoration
on reload, changed-time carryover, quantity-change invalidation, and the same
navigation with session storage blocked. Six full-page WCAG/overflow checks pass
at 1440, 390 and 320 pixels. Test records are fictional and external browser
requests are blocked. No production data, real order, email, payment or courier
request is used.

Manual acceptance after deployment is Ready: choose a mixed basket and time,
open the basket and continue to checkout. The same chosen date/time should appear
without another search. Change it in the basket, continue and verify the new
time. Change an item quantity: the previous choice should no longer be used, and
fresh available times should be offered. All displayed totals must still match
food minus discount plus current delivery.


## Finder budget/category recovery — 28 October 2026

The finder previously offered Compare both budget ranges for every empty result,
even a category miss, an unavailable kitchen date or an existing basket exceeding
the requested quantity. It also omitted a clear submitted-date summary beside
results. Recovery is now specific to the failure: try Any category, focus another
date, use the existing basket count (up to the supported 100-item total), or
explicitly compare both price ranges. Existing items and the numerical budget
are preserved. No alternative is automatically added or accepted.

Results repeat date, total count, budget mode, new-item category and existing
count. Price-only explanations use generated basket ranges, not claims about
every possible combination. A combined budget search which finds only one range
states that limitation plainly. Cart updates block new searches, and errors
from a different basket scope are hidden. Client validation refuses duplicate,
wrong-Malaysia-day, ranged or oversized slot lists for the exact-time finder.
The API, ranking, forecast models, checkout and database schema are unchanged.

Validation: frontend lint, recommendation, checkout and unit suites and production
build pass. Focused tests exercise the action matrix, budget/category/date copy,
price-evidence boundaries and exact-date/unique-slot guards. The real local API/
browser journey covers an impossible above-budget search, explicit range
comparison, an empty category and Any-category recovery without budget relaxation,
focus-only date changes, an existing four-item basket against a three-item target,
a date blocked by lead time, malformed next-day slots, stale-error hiding and a
successful two-item addition completing a three-item mixed basket with its chosen
time. Eight full-page WCAG/overflow checks pass at 1440, 390 and 320 pixels.
Fictional local records and blocked external browser requests isolate these tests;
no real order, payment, email or courier action is performed.

Manual acceptance after deployment is Ready: request an above-budget basket that
has no match and check that the proposed price range explains it. Comparing both
ranges must clearly show the broadened preference. An empty category should offer
Any category while keeping date, quantity and budget. With four items already in
the basket, a target of three should offer Use 4 total items or Review basket,
without adding anything. Kitchen-time misses should offer another date rather
than an irrelevant budget button.
