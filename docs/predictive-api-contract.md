# Predictive API contract — Dormathon 2026

Version: `1` (implemented). Current integration branch: `integration/dormathon-demo`.
Dashboard branch: `feature/ai-dashboard`.

## Recommendation result presentation — 28 October 2026

The original card-layout change was presentation-only. The independent
same-menu replacement flow documented below adds an explicit consent flag;
pricing, ranking and capacity rules remain unchanged. One-menu searches
show all returned menu alternatives together. Each card contains final quantity,
food subtotal, whole-order total, current discount/delivery, budget comparison
and its own Add action. There is no numbered basket selector or separate Add
footer in this view. A one-item request uses this direct-card view too, since
one item cannot form a multi-menu basket. Existing items count toward the target;
only the remaining quantity is added in mixed mode. Same-menu alternatives with
an existing basket use the explicit replacement flow below.

Mixed baskets keep one selected complete option and one shared Add action in a
compact, full-width order bar. Basket selectors show whole-order prices. Native
radio behavior remains for Menu choice, with a segmented visual control and
visible keyboard focus. No delivery-hour selection is introduced in the finder.

Every card action passes its own plan ID, which the parent resolves against the
current validated response before sending the existing `{session,plan,date_only:true}`
request, plus `replace_basket:true` when replacement is confirmed. All alternative
Add actions are disabled while one is in flight. The
server's existing fingerprint and idempotency checks remain authoritative; no
order, preparation reservation, stock deduction or payment occurs at this step.

## Menu choice and a single delivery-time decision — 28 October 2026

The finder now accepts optional `menu_mode: "mixed" | "same"`, default `mixed`
for existing clients. Mixed means a mix is allowed, including repeated items;
it prefers variety but does not promise multiple distinct menus when choices
are limited. Same requires the **entire final basket** to contain one menu,
with the requested total quantity. It searches independently of existing basket
contents and can return up to three alternatives, respecting category, date,
budget and daily limits. With a nonempty basket, `replaces_basket:true` requires
explicit replacement confirmation. Searching never changes the basket. Existing
mixed baskets and quantities above the requested target do not block this search. The response and saved session
context echo `menu_mode`; the browser refuses a different mode or a same-mode
plan with multiple menu rows. Responses omitting mode remain compatible only
with default mixed requests. Ranking and the existing bounded search limits
are unchanged.

The customer form starts at one item. Budget remains optional; its comparison
selector is disabled with an explanation until a budget is entered. If
`replaces_basket:true`, choosing a card opens an inline confirmation naming the
replacement menu, final count and total. Cancel keeps the basket and restores
focus; confirmation sends the explicit replacement flag. Mixed mode never
silently removes existing items. The backend rejects a missing or mismatched
replacement flag and validates the original basket fingerprint before deletion.

The finder previews **date availability** without asking the customer to choose
an hour. `POST /api/menu/basket-guide/add/` additionally supports
`{session, plan, date_only:true}`. In this form, `delivery_at` must be absent.
After the existing session/actor/expiry, quote, menu and cart fingerprint checks,
the locked transaction checks for at least one current whole-basket slot on the
session's searched day. No current slot returns 409 without adding anything.
It can use another feasible hour on that same day when an earlier preview hour
is no longer available; it never silently changes the requested date.

A date-only success adds `date_only:true`, `date:YYYY-MM-DD` and
`delivery_at:null` to the usual atomic-add receipt. It does not choose, reserve
or book an hour. Legacy explicit-time requests `{session,plan,delivery_at}`
remain supported with `date_only:false` (the default), still limited to the
returned slots and rechecked before applying. New explicit-time receipts also
include date and the false flag. Repeat requests are idempotent for the same
plan and selection type; a receipt cannot be reinterpreted later as the other
type or a different selected hour. Browser validation checks receipt type/date
as well as quantities and exact quote arithmetic.

The shared delivery preference can now store a day-only record in the existing
account/basket/fulfilment scope. It pre-fills the basket/checkout preferred day
without selecting an hour. A same-day explicit choice already belonging to that
unchanged basket is retained. Day records must be real Malaysia calendar dates
between today and +90 days and are ignored after expiry or a scope change. Old
time records remain readable. Optional browser storage failure still permits
in-memory navigation. Basket time selection stays optional: customers can choose
there, or at checkout if skipped. Once a time is chosen, checkout shows its
summary and Change time rather than another mandatory search. Quote/checkout
still recheck availability, and no order is created by adding recommendations.

No database migration, demand-model retraining, reminder scheduler or mail
configuration change is involved. The intended scheduler remains the shared
GitHub Actions workflow; this release does not invoke a live email worker.

## Finder recovery and search context — 28 October 2026

The mixed-basket response/API schema and server ranking are unchanged. The
storefront now repeats the submitted Malaysia date, final total item count,
whole-order budget mode, new-item category preference and existing item count
beside results, including empty results. A within-and-above search which returns
only one range explicitly says that no option in the other range was found in
this bounded search; it does not claim the catalogue has no such combination.

Empty-result actions depend on `empty_reason`. A price mismatch offers explicit
comparison of both budget ranges. A category/menu or kitchen-time miss offers
another date and, when a category was selected, Any category. A quantity below
existing basket count offers that current count only when <=100, otherwise the
basket must be edited. A basket-rule issue directs the customer to review their
basket. Recovery never removes items, changes the budget amount, adds products
or places an order. A date action focuses the field without issuing a request;
category/budget/count actions issue one new search for the explicitly selected
change. Price-range explanations refer only to generated candidates before
capacity checks, never all possible catalogue baskets. The form's whole-order
budget remains food minus current discount plus delivery.

Search/recovery are disabled during a cart update and errors from a different
basket/fulfilment scope are hidden. Before display, each mixed-basket plan must
contain one to three distinct exact-time slots on the requested Malaysia day;
non-null arrival-window objects are refused for this exact-time API. A malformed
or different-day response cannot expose an Add action. Checkout and atomic add
continue to recheck actual availability. No migration or model retraining.

## Delivery-choice handoff — 28 October 2026

The shared delivery preference preserves an advisory day or time across menu
suggestions, basket and checkout. A finder addition stores the searched day
against the refreshed basket without selecting an hour. A completed-basket review uses the same day action.
The shopping assistant can still carry a time explicitly selected by the customer.
The basket no longer overwrites a previously chosen time with empty route state.
Checkout reads the shared choice and still calls `/api/orders/quote/` for current
capacity; order placement remains authoritative under the existing server locks.
No slot, payment or courier status is confirmed by remembering a time.

Optional `basketDeliveryChoice` browser-session storage holds version 1, a Malaysia
local-minute value and a scope composed of account, stable basket row identities/
quantities/menu settings, fulfilment terms, area and arrival-window duration.
Malformed/expired values and scope mismatches are ignored. Account changes clear
the record; fulfilment/window changes clear it explicitly. An unchanged same-user
reload restores the day or time after current basket/pricing reads. Legacy unscoped
`preferredDelivery` and navigation-history values are no longer used to initialise
checkout, preventing stale choices from returning through old route entries.
Storage failure still allows in-memory preferences during same-page navigation;
a reload without working storage cannot restore them.

The selected-time summary is shown first, with Change time exposing the optional
search. Basket/fulfilment changes or a known unavailable quote expose fresh
choices. Every quote and submission keeps its existing basket/rule checks. API
request/response schemas, database models and forecast artifacts are unchanged.

## Mixed whole-order finder — 28 October 2026

The storefront date finder now uses `POST /api/menu/basket-guide/`, version
`mixed-basket-guide-v1`. Quantity is the **final total item count for one basket**,
not a count per recommended menu. Different menus can be mixed. Existing signed-in
basket items count toward that target and are preserved in mixed mode. Same mode
can replace the basket only after confirmation. For an empty basket,
quantity 3 can mean one rice meal, one noodle meal and one box of cookies. A box
or pack is one selling item, not its contents or a diner count.

Input: `{date, quantity, menu_mode?, budget?, budget_mode?, category?, delivery_method?,
delivery_area?}`. Date uses Malaysia calendar days, today through +90 inclusive;
quantity is integer 1–100. Optional budget is a positive two-decimal money value.
`budget_mode` is `within` (default, total <= budget), `above` (total > budget), or
`all`; above/all require a budget. Category applies to **new additions** in mixed mode and the full alternative in same mode. Budget
is the **whole-order total after current bulk discounts and delivery fees**,
including existing basket items, using the same quote rules as checkout.

The response contains `{session, version, date, quantity, menu_mode, delivery_method,
basket_known, current_quantity, basket_before, replaces_basket, budget, plans, empty_reason,
price_evidence, checked_baskets, pool_limit, checked_limit, message}`. Budget is
null or `{amount, mode, basis:"whole_order_after_discount_and_delivery"}`. Each
of at most three alternative complete plans contains `{id, items, totals,
budget_relation, slots}`. Item rows include current unit price, line total,
final quantity, existing quantity and add quantity. `totals` contains Decimal
money strings `subtotal`, `discount`, `shipping`, `total`, and final `quantity`.
Slots are checked with every item together, never by combining independent
per-menu availability. Nothing reserves a preparation slot, creates an order,
deducts stock, charges payment or sends a notification.

Search is intentionally bounded: up to 12 candidate menus seeded by history/
popularity and price extremes; common mixed distributions and larger balanced
groups; at most 30 whole-basket capacity checks. This is not an exhaustive
combination search or an optimal spending guarantee. Budget filtering happens
before top-three selection. Both mode alternates the two price partitions when
available; it cannot promise a capacity-feasible result in both ranges.
Optional `price_evidence` uses scope `generated_combinations_before_capacity`,
with `considered_baskets`, `within_count`, `above_count`, and minimum/maximum
order totals (null for an empty candidate set). It describes generated candidates,
not every possible catalogue combination or verified capacity.

Empty reasons are `quantity_below_basket`, `existing_menu_mix`, `basket_needs_review`, `no_price_match`,
`no_kitchen_times` and `no_menu_match`. An already complete target returns a
review-only basket in mixed mode. A target below existing quantity never removes
items during search; same-menu replacement requires explicit confirmation.
Guests preview an empty basket and must sign in and search again before adding.

`POST /api/menu/basket-guide/add/` accepts `{session, plan, delivery_at}` or
`{session, plan, date_only:true}` as detailed above.
Authenticated session/CSRF and the discovery browser key are required. A new
application must be within 15 minutes; an explicit chosen time must belong to
that saved complete plan, while date-only additions recheck the whole searched
day. A user-row lock serializes cart changes; storefront, recommendation
session and product rows are also locked. Current basket, menu/price, promotion,
fulfilment terms and whole-basket capacity are rechecked before an atomic write
of additions, or an explicitly confirmed replacement. Stale quotes/capacity return
409 without changing the basket. For replacement sessions, the request must include
`replace_basket:true`; an addition session cannot be escalated into replacement.
Replacement ignores old menu eligibility when choosing new food, but fingerprints
the entire old basket and deletes/recreates its rows only inside the successful
locked transaction after price/capacity checks. A failed write rolls back the
original basket and the session receipt together.
The session stores a committed receipt. Repeating the same plan/selection type (and
explicit time, where supplied) within the
24-hour retained session is idempotent; a different option/time is rejected.
A replay after later cart changes reports `basket_changed:true` without rewriting
it. Success returns `{added,session,plan,already_applied,basket_changed,quantity,
added_quantity,replaced_basket,date_only,date,delivery_at,totals}`. Replacement
plans use `existing_quantity:0` and `add_quantity:quantity`, with the real old
quantity retained in `current_quantity` and `basket_before`. Requests cannot provide prices or quantities.

The browser verifies item counts, unit/line/quote arithmetic, requested budget
relation and add receipts. Basket/account/fulfilment changes invalidate displayed
results. An unconfirmed add response refreshes the basket and requires a fresh
search, preventing a blind repeat. Compact food cards show a unit price and one
reason, then a single shared basket breakdown, date-availability note and Add
action. The hour is chosen in the basket or checkout. The full catalogue and instant recommendations remain independent.

The earlier `/api/menu/guide/` per-menu API below remains available for compatibility;
its food-only budget semantics do not describe the new storefront finder. No
schema migration, model artifact change or retraining is required.

## Private email delivery check — 27 October 2026

`GET /api/admin/reminder-status/` additionally returns `email_delivery`:
`{transport_ready, sender_address, owner_recipient, test_available}`. Addresses
are validated current configuration, or null if missing/invalid. SMTP login and
password are never returned. This staff-only response is private/no-store. It
does not identify the destination of an earlier aggregate worker count or prove
that SMTP credentials, inbox delivery or automatic scheduling work.

`POST /api/admin/email-delivery-check/` is staff-session/CSRF protected and takes
no address, subject or message input. It sends one fixed diagnostic message to
the configured owner recipient. Only the explicit UI button invokes it; status
reads and refresh never send. SMTP configuration, a valid owner address and a
valid sender are required; the default `kitchen@localhost` sender is unavailable.
Use a provider-approved sender, e.g. the Gmail account or configured Send mail as
alias for Gmail SMTP. Format validation cannot certify provider approval.

One attempted check per staff account per five minutes is enforced with the
existing authentication-event table and a user-row lock released before SMTP.
The check returns 202 for provider acceptance, 503 for a known rejection or an
unconfirmed result, and 429 with Retry-After during cooldown. Accepted/rejected/
unknown results include a searchable `FCMAIL-<12 hex>` reference, fixed recipient,
`retry_after:300`, outcome (`accepted|not_accepted|unconfirmed`) and a fixed reason
code (null for accepted). Raw SMTP errors are never exposed. A timeout/disconnect
can occur after acceptance; it stays unconfirmed and has no automatic retry.

Checks are separate from worker history, order eligibility and OrderReminder
receipts. They change no order, stock, payment or scheduler settings. No schema
migration is needed. Receiving the check is evidence of that message's delivery,
not proof of future customer delivery. Provider delivery/bounce evidence remains
necessary to diagnose a provider-accepted message missing from the inbox.

## Legacy per-menu date-guide budget comparison — 27 October 2026

`POST /api/menu/guide/` adds `budget_mode`: `within` (default), `above`, or `all`.
The supplied `budget` is the **total food amount for the requested quantity of
one menu before discounts**, excluding delivery and existing basket items.
`within` means total <= budget; `above` means total > budget; equality remains
within. Above/all comparisons require a budget. Legacy requests without a budget
or mode retain their existing unfiltered/default-within behaviour.

The server compares Decimal `price × portions` totals. Each row retains `price`,
`portions` and `food_total`, and adds `budget_relation` (`within`/`above` or null)
and `budget_difference` (absolute Decimal money string or null). The top-level
`budget` is null or `{amount, mode, basis: "food_total_before_discounts_and_delivery"}`.
Responses still contain at most three results and check at most 30 ranked menus.
In all mode, when both ranges have available times within that bounded scan, the
selection includes each range. The existing history/popularity ranking otherwise
remains in force. No available kitchen times are invented to satisfy a budget.

Session context is `date-guide-v2` and records budget mode. Existing session-bound
attribution and instant date-free menu suggestions are unchanged. The browser
checks returned quantity, unit-price arithmetic and budget relation against the
submitted preferences before displaying results. Search filters apply to the
finder only, not the catalogue, instant cards or whole basket. Recommendation
selection still reserves nothing and checkout remains authoritative. No database
migration or demand-forecast/model artifact changes.

The response optionally adds `budget_catalogue` (null without a budget), with
scope `date_category_recipes_before_capacity`, the requested `quantity`,
`menu_count`, `within_count`, `above_count`, and Decimal-string
`minimum_food_total`/`maximum_food_total` (both null for zero menus). This price
evidence covers all active, recipe-backed, locally orderable menus open for the
requested date/category **before** budget filtering, ranking, top-three selection
or the bounded kitchen-capacity scan. Shipping-enquiry-only offers are excluded.
Counts partition total price <= budget versus > budget; they do not certify
capacity. Above-budget filtering already preceded the top-three limit and remains
unchanged. A menu outside the first three recommendations can be returned by an
above-budget search if it meets the filters and has a workable kitchen time.

The earlier per-menu UI labelled quantity per menu, identified results as alternatives, and showed
this range to explain empty above-budget results when every matching menu total
is within the threshold. Client validation checks partition counts, requested
quantity, range ordering/budget boundaries, and consistency with returned rows.
The range never manufactures a more expensive offer to fill a result slot.

## Inventory deadline evidence — 27 October 2026

Existing inventory fields, staff access and versioned PATCH contract are
unchanged. For `expiry_basis=storage`, `received_date + shelf_life_days` gives
the base deadline; `manufactured` uses `manufactured_date` instead. Calculated
modes require a nonblank `guidance_note`. A client-supplied `expiry_date` cannot
override this calculation. `label` uses the recorded original printed date.

All modes now take the earliest of their base date, `original_expiry_date`, and
documented opened/thawed deadlines. When changing a legacy labelled batch whose
original date is null, omitting that field retains its saved printed expiry as
the cap. Printed limits cannot precede receipt. Existing event/date-pair and
handling validations still apply; unknown handling or a breach forces a hold.
No mass rewrite of stored records occurs; existing evidence needs review on edit.

The browser shows only the relevant mode fields and previews calendar-day
arithmetic; the server remains authoritative. Switching calculated to labelled
mode requires an actual printed date rather than relabelling a calculated one.
The source link is general reference material, not auto-verified guidance or a
physical safety assessment. No shelf-life values are preseeded. This deadline
fix alone needs no schema or forecast/model change.

## Reusable ingredient storage guidance — 27 October 2026

After migration `0023_raw_material_storage_guidance`, existing staff-only raw
material list/create/detail endpoints expose `storage_guidance`, an optional
JSON array (default `[]`). Each entry has exactly `storage_type`
(`chilled|frozen|ambient`), `shelf_life_days` (integer 1–3650), `source`
(nonblank, at most 140 characters) and `conditions` (nonblank, at most 155).
One entry per storage type, at most three. Unknown entry keys, null, duplicate
types and incomplete entries are rejected. Omitting guidance on an existing
material PATCH preserves it; `[]` explicitly removes it. Existing unit-change
and deletion restrictions still apply. No public/customer access is added.

Guidance is receipt-based and remains owner-documented. The API does not infer a
manufacturing date or auto-apply a material reference to stock. The browser's
explicit copy action selects a matching material/storage entry, switches to
receipt-based calculation and copies days plus `source; conditions` into the
existing batch evidence fields. The joined text fits the 300-character batch
note. The owner may use custom evidence instead. Printed/opened/thawed caps and
holds remain in force. Changing a material reference never rewrites existing
batches; changing the selected ingredient in a new-batch form clears the old
date evidence. No durations are seeded or advertised as safety guarantees.

The migration is additive; old code ignores the new field. Do not deploy this
code before applying the migration. See `docs/freshcast-storage-guidance-release.md`.
Forecast/model artifacts, allocation and reminder behavior are unchanged.

### Inventory form presentation follow-up

The main form presents the date method, storage and its relevant date fields.
Package-date mode hides optional evidence inside handling details and does not
show receipt-based template controls. An explicit no-package-date action opens
receipt-based calculation, where matching saved ingredient guidance and custom
documented days/source remain available. Manufacturing and package expiry are
labelled separately. Source of purchase does not force a date method: unpackaged
stock can have supplier documentation, and packaged stock may need a calculation.

Supplier/cost and opened/thawed/handling fields remain available in two collapsed
sections. Existing limits are indicated in the summary and remain in the preview
and server validation. The hold is always visible. An edited batch shows its
fixed ingredient name; the quantity-adjustment reason appears only after the
quantity differs from the version loaded into the form. The server still checks
the version and requires reasons for actual quantity changes.

Changing storage clears the prior calculation's days and source for review,
without clearing earlier label/event limits or holds. The browser cannot verify
source accuracy or handling temperatures. Past best-before rows say so rather
than claiming measured spoilage; allocation still excludes them conservatively.
No API fields, schema, stock quantities, forecasts or reminder rules change.

## Manual courier handover — 27 October 2026

Owner Orders and both Planner order/run views share a recipient-copy panel and
the existing `POST /api/admin/orders/<id>/tracking/` form. Tracking's versioned
request/response, staff access and customer-private courier phone contract are
unchanged. The UI verifies returned order identity, unchanged progress/payment
and submitted courier data before reporting a save. A stale or unknown result
requires refreshing the order. Copied recipient details use the accepted address
and explicit per-order contact; incomplete/older addresses require verification.
Clipboard and WhatsApp draft actions do not contact a courier, send a message,
book delivery, generate a tracking ID or advance an order. GrabExpress booking,
provider webhooks and automatic reference imports remain unimplemented pending
official regional/account access. No schema or forecast/model contract changes.

## Grouped actual order progress — 27 October 2026

`POST /api/admin/orders/progress/` is staff-session/CSRF protected. Body:
`{"status":"cooked|shipped|delivered","orders":[{"id":12,"version":"<updated_at>"}]}`.
Select 1–20 distinct orders, each with its exact last-read `updated_at`. Success
returns `{"updated":[{"id":12,"status":"cooked","updated_at":"<new timestamp>"}]}`.
All selected orders and stock writes commit together. A stale version returns
409, a missing order 404, invalid transitions/recipes/stock 400; none apply a
partial group. Unknown network/server results require a fresh Planner read,
not a blind retry. Fields for payment changes are not accepted.

Individual status PATCH and grouped updates share the same transition rules.
Food ready (`cooked`) requires a complete reviewed schedule for pending **and
processing** orders and deducts accepted recipes once from usable FEFO stock.
The group locks orders by ID and the union of stock by material/expiry before
deductions. Pickup cannot be shipped. Courier handover (`shipped`) queues the
existing separately opted-in dispatch notice once; it does not send mail inside
the transaction or book a courier. Actual customer receipt/collection is
`delivered`, allowed from cooked or shipped. Preparation-start and dispatch
tracking remain optional; no clock automatically marks an order ready, shipped
or delivered. Progress does not take payment, mark an order paid, reserve new
capacity or alter recipes/delivery dates. No schema/model/forecast changes.

## Optional menu trading windows — 23 October 2026

### Fulfilment extension (batch 2)

`GET/PATCH /api/storefront/` additionally exposes `delivery_enabled` (default
true), `pickup_enabled` (default false), `pickup_location`, `pickup_instructions`,
`delivery_open_hour/close_hour` (9/21), `pickup_open_hour/close_hour` (8/20),
`delivery_areas` (up to 30 unique area names, default []), `delivery_fee_myr`
(Decimal string, default `5.00`) and nullable `free_delivery_minimum_myr`
(default `50.00`). Hours are whole integers 0–23 with open < close. Pickup requires
a nonblank location before enabling. Settings writes are staff-only and hold
the store row lock. Inactive pickup location/instructions are hidden from public
settings; staff and accepted-order snapshots retain them.

Quotes, hourly basket searches and checkout accept `delivery_method`:
`standard`, `express` or `pickup`. Omitted method defaults to delivery when
enabled, otherwise pickup. Quotes/checkout also accept `delivery_area` (a declared
configured area required for delivery when the store restricts areas). Pickup
ignores addresses and has zero shipping/travel buffer; delivery requires an
owned address. Discovery remains advisory and never reserves capacity. Hourly
responses may contain up to **24** distinct slots for owner-configured windows.
Date recommendations accept the same optional method. Shopping basket estimates
accept the method and include the matching shipping policy in signed previews.

Orders expose read-only `fulfilment_snapshot`: method, human label, accepted
open/close hour, buffer minutes, pickup location/instructions and declared area.
`delivery_at` also represents collection time. The stored `shipping_fee` is
computed server-side. Replanning/rescheduling retains saved fulfilment terms.
Collection's user-facing completed state is **Collected**, stored as `delivered`
for existing analytics; pickup cannot transition to `shipped`. Order-linked
escrow is delivery-only because its contract requires dispatch. Other enabled
payment paths support pickup. No forecast/model API or model artifact changes.
See [fulfilment workflow and release notes](HOME-FOOD-FULFILMENT.md).

Product detail/create/update and public `/api/menu/` expose `delivery_dates`
(up to 90 unique ISO calendar-date strings; empty means no specific-date limit),
`order_cutoff_time` (nullable `HH:MM:00`, Malaysia time) and
`order_cutoff_days_before` (integer 0–90, default 1). Only staff can change them.
Both delivery weekdays and specific dates apply. These checks run in quotes,
checkout (including review requests), recommendations and owner replanning.
Daily capacity and cooking advance notice remain independent constraints.

`POST /api/orders/slots/` with `find_next=true` may jump to the next shared offered
date beyond next week, within the existing 90-day booking limit. It returns
`unavailable_code: no_common_date` and empty slots when no shared still-open date
remains; this is a successful availability response, not an API outage. The
bounded hourly scan starts at that offered date and reserves nothing.

Local decision-support menus' `demand_adjustments` additionally contains
`order_cutoff_excluded`: raw forecast portions excluded from **additional** demand
because their ordering deadline has closed. `delivery_day_excluded` now includes
specific dates as well as weekdays. Confirmed accepted recipe requirements and
historical evaluations are unchanged. Legacy clients may ignore the new key;
current clients accept its absence from older responses. Genpact and sample-data
contracts are unchanged. See [home-food case study](HOME-FOOD-CASE-STUDY.md).

## Availability and scope

Staff recovery download: `GET /api/admin/predictive/model-backup/` uses the existing
staff session and returns the fixed checksum-verified original runtime archive
(`application/gzip`, attachment, `X-Checksum-SHA256`, private/no-store). It accepts
no parameters, rejects nonstaff access and returns 503 if the archive is missing
or corrupt. It exports no kitchen database records. The separate bearer-only
deployment transfer route is unchanged. See [GitHub backups](github-backups.md).

**The five Genpact endpoints, `backtest/`, `local-plan/` and `local-scenario/` are implemented**.
The local plan reads database orders and stock without using a model; its distinct
schema is documented below. The evaluated Genpact CatBoost artifact
achieved 28.23% WAPE versus 34.81% baseline on weeks 136–145. A complete separately
provisioned bundle and optional ML dependencies are required; Git alone does not
supply them. See `backend/predictive_ai/README.md` for reset and deployment steps.
Generated operations currently cover center 13 only; other centers return HTTP
503 `operational_data_unavailable`. No empty/fabricated forecast is substituted.

The forecasting domain is external Genpact **weekly** center/meal demand.
`meal_id` is never a Dapur Kita `Product.id`. Recipe, stock, costs and supplier
inputs initially use explicit simulated operational data. No local FYP stock is
read or modified by those five Genpact endpoints. The separate local plan uses
accepted order recipes and raw-material IDs; it does not map Genpact meals onto
the store's menus.

The separate local preorder readiness audit does not change these endpoints or
their demand source. No local model is exposed by these endpoints; see
[local training preparation](LOCAL-PREORDER-TRAINING.md). Both expiry surplus
and shortage risks are calculated. Explanations include shortfall, illustrative
replenishment and safety stock; no purchase is executed.

Database order storage is distinct from these prediction sources; see
[data-source clarification](FRESHCAST-DATA-SOURCES.md). A separate protected
deployment transfer route `/api/internal/freshcast-bundle/` is not a dashboard
API and cannot access business records. Its bearer credential is server-only;
the existing staff authentication rules below remain unchanged.

A separate [local recorded-booking CatBoost experiment](LOCAL-BOOKING-EXPERIMENT.md)
is trained offline. It predicts aggregate recorded booking volume, not menu
fulfilment or ingredient use, and did not beat the trailing-average baseline.
It is not deployed or compatible with this Genpact response schema. Do not
replace these metrics/source labels with its experimental results.

The separate [public bakery benchmark](PUBLIC-BAKERY-DEMO-FEASIBILITY.md) is also
offline. No bakery forecast/import endpoint is implemented, and its model is not
used by either the Genpact routes or `local-plan/`.

## HTTP rules

Base: `/api/admin/predictive/`; trailing slashes required. JSON UTF-8. All
operations require Django staff permission (`IsAdminUser`) and existing session
authentication. Session-authenticated POST requires CSRF using existing frontend
conventions. Anonymous/nonstaff requests return HTTP 403 under existing DRF
session defaults. GET is read-only; POST scenarios are nonpersistent and cannot
send messages, deduct stock, or create orders.

For Genpact responses, integers are IDs/week indices; floating-point numbers
are forecasts, kg quantities, MYR amounts and percentage metrics. The local
plan uses native material units and calendar dates instead. Unknown costs are
`null`, never zero. All output numbers must be finite. Arrays may be empty only
after a successful calculation. Genpact weekly expiry is an inclusive bucket,
not a calendar date or proof of food safety. Its simulated prices and operational
quantities must not be labelled real shop observations.

## Genpact endpoints

`center_id` and `week` use positive integers from 1 to 2147483647, encoded as
integers or ASCII digit strings of at most 10 characters. Booleans, zero,
fractional values and oversized strings return 400 `invalid_parameters` before
model loading. Membership and supported-week checks then use the loaded bundle.
`metrics/` and `centers/` accept no query parameters. Forecast/scenario responses
and their source labels are unchanged.

### Labelled held-out replay (implemented)

`GET backtest/?center_id=13&week=136` requires both positive integer parameters;
only weeks 136–145 from the saved artifact's validation metadata are supported.
Unknown, repeated, missing or additional parameters return 400. No observations
for a valid selection return 422 `no_eligible_history`. Missing data/model return
the existing 503 errors. Staff permission is required; POST returns 405;
responses use `Cache-Control: no-store`. No business database records are written.

Success fields: `api_version: "1"`, `mode: "historical_backtest"`, `center_id`,
`week`, `model_status: "ready"`, `training_max_week: 135`,
`evaluation_protocol: "rolling_one_week_ahead"`, `observations` (row count),
`actual_orders_total`, `sources: {demand: "GENPACT_HISTORICAL", operational:
"NOT_USED"}`, `warnings`, `scores`, and `meal_comparisons`.
`scores` contains `catboost` and `previous_observation`; each has
`wape_percent` (number or null when actual total is zero) and
`mae_orders_per_meal` (number). Each comparison has integer `meal_id`, numeric
`actual_orders`, `predicted_orders` and `baseline_orders`.

This replays the already reported holdout, not newly collected independent data.
Only earlier quantities enter shifted features. Recorded target-week prices and
promotion flags are assumed known. The previous-observation baseline may span
missing weeks. Selected scores are not the pooled whole-holdout scores. No stock
risks are returned; replay is separate from the week-146 future scenario.
The existing React dashboard does not call this endpoint. After staff login,
open the endpoint URL directly for a JSON/DRF demonstration or request it using
the existing session. Do not pass this schema to `validateForecast`.

### Forecast and metrics endpoints

| Method | Relative path | Inputs | Success body |
| --- | --- | --- | --- |
| GET | `metrics/` | none | `api_version`, `model_status`, `metrics`, `warnings` |
| GET | `centers/` | none | `api_version`, `forecast_week`, `centers`, `warnings` |
| GET | `forecast/` | required integer `center_id`; optional integer `week` | Forecast response below |
| GET | `inventory-risk/` | same as forecast | Same forecast response, including risks and allocations |
| POST | `what-if/` | JSON below | Same forecast response with scenario flag set |

`week` defaults to the maximum historical week plus one. Any other horizon is
HTTP 400. Unknown centers are HTTP 400; known centers with no eligible history
produce an explicit 422 error. No implicit all-center forecast. The initial
scenario controls only promotion flags; no claimed causal uplift.

Metrics object retains training script names: `train_max_week`,
`validation_start_week`, `validation_end_week`, `train_rows`, `validation_rows`,
`model_wape_percent`, `lag1_baseline_wape_percent`, `model_beats_baseline`,
`warning`. WAPE is a percentage, not a fraction. `model_status` is `ready` only
with a genuinely trained and compatible artifact and metrics. Missing prerequisites
return 503, not fabricated metrics. Centers entries use `center_id` (integer),
`center_type` (string), `op_area` (number). City/region fields are not promised.

### Forecast response shape

This is a shape example with empty arrays, **not a generated forecast**:

```json
{
  "api_version": "1",
  "center_id": 1,
  "week": 146,
  "horizon_weeks": 1,
  "promotion_scenario": false,
  "sources": {
    "demand": "GENPACT_HISTORICAL",
    "operational": "SIMULATED",
    "product_mapping": "UNMAPPED"
  },
  "meal_forecasts": [],
  "ingredient_risks": [],
  "batch_allocations": [],
  "warnings": []
}
```

`146` is illustrative; use the returned `forecast_week`, never hardcode it.
`meal_forecasts` entries: `center_id`, `meal_id`, `week`, `predicted_orders`.
Predictions are nonnegative model estimates, not confirmed bookings or rounded
integer orders. Only meals with explicitly simulated recipes contribute to
ingredient calculations; list uncovered meal IDs in warnings.

`ingredient_risks` entries:

- `ingredient_id`: stable string key; quantities below are kilograms.
- `risk_type`: `expiry_surplus`, `shortage`, `expiry_surplus_and_shortage`, or `none`.
- `forecast_demand_kg`, `available_kg`, `expiring_unused_kg`, `shortfall_kg`:
  nonnegative numbers; demand equals sum of forecast orders times recipe kg/order.
- `potential_waste_cost_myr`: nonnegative number or null when any surplus cost is
  unknown; calculate each unused expiring batch at its own cost before summing.
- `illustrative_reorder_kg`: max(0, demand + simulated safety stock - eligible stock).
- `action`, `explanation`, `risk_inputs_note`: plain-language strings explaining
  forecast need, eligible stock, expiry bucket, uncertainty and proposed action.

`batch_allocations` entries: `batch_id` (string), `ingredient_id` (string),
`expiry_week` (integer), `eligible` (boolean), `exclusion_reason` (null or
`expired`), `consumed_kg`, `remaining_kg`, `potential_waste_cost_myr`.
All allocation is hypothetical. Expired batches consume zero. Eligible batches
allocate in `(expiry_week, batch_id)` order; current-week surplus is potential
waste, not measured spoilage. Include inventory-only ingredients with zero demand
so excess stock is visible. Initial simulated batches do not model received-week
or quarantine state; do not infer their absence in real stock.

Risk ordering: known potential waste MYR descending, then current-week expiry
surplus descending, shortfall descending, ingredient ID ascending. Unknown costs
must be disclosed in warnings rather than imply no risk. Shortage purchasing
costs require a separate verified supplier-price source; no guaranteed delivery
or savings. Promotion recommendations remain speculative.

### Nonpersistent scenario request

```json
{"center_id": 1, "week": 146, "promotion_scenario": true}
```

Reject unknown fields, booleans/fractions as integer IDs, nonboolean scenario
flags, unavailable centers and unsupported weeks. Set both observational promotion
flags for this hypothetical scenario; disclose that prices and other covariates
are assumed and response is not a causal comparison. Default forecast is
`promotion_scenario: false`.

## Local kitchen planning endpoint

`GET /api/admin/predictive/local-plan/?horizon_days=7` requires the same existing
Django staff/session permission. Only `horizon_days` is accepted: an integer
1–28, default 7. Repeated/unknown parameters and invalid integers return HTTP 400
`invalid_parameters`. POST returns 405. No center/week/Genpact mapping is involved.
The response uses `Cache-Control: private, no-store` and reads current database
rows on each call, without altering them. It does not require model artifacts,
historical CSVs or optional ML dependencies.

This is **known booking planning, not a model forecast or learned baseline**.
The five Genpact responses and their frontend validator remain unchanged. Do not
pass a local response into that validator or label it a live CatBoost forecast.
See [the frontend handoff](LOCAL-KITCHEN-INTEGRATION.md).

Top-level fields:

| Field | Type / meaning |
| --- | --- |
| `api_version` | String `"1"` |
| `mode` / `model_status` | `"local_plan"` / `"not_used"` |
| `as_of` / `timezone` | Current local ISO date / Django current timezone name |
| `window` | `start_date`, `end_date` ISO dates, `horizon_days` integer; inclusive |
| `sources` | `demand: "CONFIRMED_PAID_PREORDERS"`, `operational: "DATABASE"`, `product_mapping: "ACCEPTED_ORDER_RECIPES"` |
| `coverage` | Integer `active_orders`, `included_orders`, `excluded_orders`, `positive_batches`, `eligible_batches`, `hypothetical_batches` (0 in the baseline) |
| `included_orders` | Entries: integer `order_id`, `portions`; ISO `preparation_date`, `use_by_date`; `items`: nullable integer `product_id`, string accepted `product_name`, integer `quantity`; `requirements`: integer `raw_material_id`, numeric `quantity`, native `unit` |
| `excluded_orders` | Entries: integer `order_id`, string `reason` |
| `ingredient_risks` | Local material rows below, including inventory-only materials |
| `batch_allocations` | Integer `order_id`, `batch_id`, `raw_material_id`; numeric `quantity`; `unit`; ISO `needed_by`, `use_by_date` |
| `batches` | Integer `batch_id`, `raw_material_id`; `unit`; numeric `quantity`, `allocated_quantity`, `remaining_quantity`; ISO `received_date`, `expiry_date`; boolean `eligible`, `hypothetical` (false in baseline); string array `exclusion_reasons`; additive string `batch_code` (empty for a nonpersistent purchase scenario) |
| `shortages` | Integer `order_id`, `raw_material_id`; numeric `quantity`; `unit`; ISO `needed_by` |
| `recommendations` | Integer `priority` starting at 1, `raw_material_id`; `ingredient_id`, `risk_type`, nullable ISO `urgent_by`, `action`, `explanation` |
| `warnings` | Array of strings, always display source/coverage caveats |

Orders considered are `pending` or `processing` only. Include paid orders whose
inventory has not already been deducted, with a nonempty reviewed preparation
plan (`needs_review` absent/false), valid preparation start/end and delivery.
The start date must fall in the inclusive window; end may fall after it. Require
batch expiry on/after the preparation end date, conservatively covering the whole
preparation period. No delivery/consumption dates are invented from creation dates.
Require a complete accepted recipe snapshot for every item; do not fall back to
today's mutable menu recipe. Units convert `g` ↔ `kg`, `ml` ↔ `l` and `unit` ↔ `unit`.
Mass/volume conversions are rejected. Invalid/nonpositive quantities or a missing
recipe exclude the entire order, avoiding misleading partial requirements.

Exclusion reasons: `inventory_already_deducted`, `not_paid`,
`preparation_needs_review`, `missing_schedule`, `invalid_schedule`,
`overdue_preparation`, `outside_horizon`, `missing_items`,
`missing_accepted_recipe`, `invalid_recipe_quantity_or_unit`.
Cancelled/delivered/cooked/shipped orders are outside the active-order query, not
future demand. `coverage` describes only this query; it is not a total order count.
Unpaid COD orders are also excluded under this conservative paid-order policy.

Positive stock batches are ineligible if quarantined, already expired, not yet
received, or expiry precedes receipt. These reasons may overlap. Eligible expiry
dates are inclusive. Allocate order-by-order by preparation timestamp, then order
ID; within each material use earliest expiry then batch ID. Allocate a batch at
most once across requirements. Quantities are in each raw material's recorded
unit, **not always kg**. No demand prediction or safety stock is added.

Local `ingredient_risks` entries:

- `ingredient_id`: stable `"raw-material-<ID>"` string; integer `raw_material_id`;
  `ingredient_name`, `unit` strings. These IDs identify database materials.
- `risk_type`: `expiry_surplus`, `shortage`, `expiry_surplus_and_shortage`, `none`.
- `confirmed_requirement`: sum of accepted per-portion quantities × included
  item quantities, converted into the material's unit.
- `eligible_stock`: currently eligible stock; it may expire before an order's
  preparation end and therefore need not cover the requirement.
- `allocated_quantity`: sum of advisory FEFO allocations.
- `shortfall_quantity`: requirement minus allocated quantity, not merely
  requirement minus on-hand stock.
- `expiring_unused_quantity`: unallocated eligible stock dated to expire on or
  before `window.end_date`; excludes already expired/held/not-received batches.
- `potential_waste_cost_myr`: sum of expiring unused quantities × each batch's
  recorded `unit_cost`; null if any contributing cost is missing; zero if no
  expiry surplus. This is estimated exposure, not observed waste or savings.
- `estimated_purchase_cost_myr`: shortfall × material `estimated_unit_cost`,
  or null when absent. A recorded estimate, not a supplier quote or lost revenue.
- `urgent_by`: earliest shortage preparation date or unused batch expiry date,
  nullable for no risk; `action`, `explanation` are plain strings.

Risks/recommendations sort by risk before no-risk, earliest urgency date, known
waste cost before unknown, descending known waste exposure, material ID. Do not
compare gram and litre quantities as a financial/severity ranking. Shortage
purchasing spend is not treated as the value of lost sales. No supplier lead times,
causal promotion effects, financial savings, purchases or stock deductions exist
in this endpoint. The separate hypothetical purchase endpoint below does not
execute any purchase or predict additional demand.

The frontend must show excluded-order warnings even when requirements/risks are
empty. A successful empty calculation is **not proof of zero shop demand**. The
database may contain fictional demo records; `DATABASE` means storage provenance,
not verified customer activity. Dates and costs remain owner-maintained inputs;
their use is not a guarantee of food safety or real-business forecast accuracy.

### Local hypothetical purchase comparison (implemented)

`POST /api/admin/predictive/local-scenario/` uses the existing staff session and
requires CSRF. GET returns 405. Request JSON:

```json
{
  "horizon_days": 7,
  "raw_material_id": 16,
  "quantity": "300.000",
  "unit_cost": "0.020000",
  "arrival_date": "2026-10-12",
  "expiry_date": "2026-10-16"
}
```

This is a shape example, not a current supplier quote. `horizon_days` defaults
to 7 (1–28). The other five fields are required. Material must exist; quantity
is positive with at most three decimal places; unit cost is nonnegative with
at most six decimal places or null (unknown). Dates are ISO calendar dates;
arrival must be inside the current inclusive window; expiry must be on/after
arrival. Unknown fields, invalid values and non-object bodies return 400
`invalid_parameters`; serializer errors may also include an `errors` object.
The quantity/cost are always in the selected material's native unit. There is
no arbitrary unit conversion, promotion uplift, demand multiplier or automatic
supplier selection. Past receipt dates are not accepted.

Success fields: `api_version: "1"`, `mode: "local_purchase_scenario"`, `purchase`,
`baseline`, `scenario`, `warnings`. `purchase` echoes the validated inputs plus
`unit` (decimal fields are strings or null). Both plans use the local-plan schema
above and are calculated from one shared database snapshot. `scenario.sources`
changes only `operational` to `DATABASE_WITH_HYPOTHETICAL_PURCHASE`.

The hypothetical batch has `batch_id: -1`, `hypothetical: true`; it may appear
in allocations. All database batch IDs remain positive. Scenario allocations
require its arrival on/before order preparation start and expiry on/after
preparation end. Overbuying can create additional expiry exposure. Baseline
costs remain recorded estimates; assumed new-batch cost stays unknown if null.
`positive_batches` counts database batches; `hypothetical_batches` is 1 in the
scenario; `eligible_batches` includes the hypothetical candidate. Scenario
`eligible_stock` includes the assumed future purchase and is not current
on-hand inventory. No order, stock, payment or purchasing row is changed.
Responses use `Cache-Control: private, no-store`.

The existing React assistant now defaults to `source=local` (also when omitted),
with `horizon=7` by default. It uses a distinct local validator and native units,
shows coverage/exclusions, menu snapshots and stock evidence, and calls this
comparison with CSRF. `source=live` retains the Genpact model demonstration;
`source=demo` retains explicitly labelled frontend fixtures. Local mode never
loads Genpact metrics or silently substitutes frontend fixtures. Switching
sources clears selections; editing purchase inputs clears prior comparisons.

## Errors and synchronization

Predictive error body:

```json
{"code": "model_unavailable", "detail": "Train and evaluate the demand model before requesting forecasts."}
```

Codes: HTTP 400 `invalid_parameters`; 422 `no_eligible_history`; 503
`source_data_unavailable`, `model_unavailable`, `operational_data_unavailable`.
Authentication errors retain existing DRF `detail` behavior. Unexpected failures
use the existing sanitized exception handler; never expose filesystem paths,
CSV contents or tracebacks. Dashboard should render these states explicitly.

Backend endpoint tests must enforce field names, finite JSON numbers, staff
permissions, CSRF, invalid input, missing model/data, FEFO and no database writes.
Update this document in the same commit as endpoint/schema changes. Frontend mocks must be explicitly labeled fixtures.

# Local delivery forecast (implemented 2026-10-16)

## Forecast-to-decision integration

`GET local-decisions/?horizon_days=1..28` returns the existing local-plan envelope
plus `decision_support` (source LOCAL_KITCHEN): per-menu daily baseline forecasts,
chronological evaluation, recipe coverage, ingredient projections, sensitivity
ranges, alert/review counts and assumptions. `POST local-decision-scenario/`
accepts the existing local-scenario purchase fields and returns enriched baseline
and hypothetical-purchase plans, both recalculated from stored records. These
endpoints are staff-only, private/no-store and do not mutate operational records.
The inherited `model_status: not_used` describes confirmed-order allocation;
`decision_support.forecast_status` separately reports evaluated_baselines,
limited_baselines or insufficient_history for the forecasting layer.

`POST local-reviews/` accepts request_id UUID, raw_material_id, horizon_days,
action (purchasing/menu/marketing/wait), optional note (1000 chars), nullable
nonnegative action_cost and nullable assumed_avoided_percent (0..100). It returns
a signed, fresh snapshot and token for browser storage/export, not a server log.
Browser copies and follow-up notes are cleared on logout/account changes; a
same-account reload retains them. Download a signed slip before signing out to
restore it later with staff access. Late save/import responses from an older
account session cannot repopulate browser storage.
`POST local-review-outcomes/` accepts only token, verifies its signature/one-year
age, and returns recorded waste for snapshot batches and calendar-day delivered
paid portions for mapped menus. Both require staff session/CSRF and perform only
database reads. Invalid/tampered tokens return 400. Neither sends marketing,
deducts inventory, reschedules orders or records financial transactions.

See [Showcase local kitchen guide](SHOWCASE-LOCAL-KITCHEN.md) for the complete
target, evaluation splits, forecast de-duplication, false-alarm policy, browser
review persistence, worksheet assumptions, limitations and impact protocol.

The local decision assistant and forecast page both display the website-order
baseline. Stock-planning exclusions do not hide this panel. The response includes
`database_coverage` (all order counts by status), `recent_orders` (latest 50 order
IDs, effective dates with provenance, statuses, payment states and portions; no
customer details), and `baseline` (four-week sales moving average). The baseline
is shown first, independently of the optional fitted-model comparison.

`recorded_preorders` separately reports historical non-cancelled, non-refunded
preorder volume and its four-week moving average. It includes unpaid/unfinished
orders and is explicitly **not realised sales**. This fallback is visible when
there is no eligible paid delivered sales history. Both series use completed
effective-delivery weeks and explicit preorder-date fallbacks. Future/current
week records remain visible in `recent_orders` but do not enter either baseline.

`GET /api/admin/predictive/local-forecast/` is staff-only, takes no parameters,
and returns `Cache-Control: private, no-store`. It does not load Genpact CSVs,
CatBoost or optional ML packages. Its response is independent of `local-plan/`:
historical orders do not need accepted ingredient recipes to contribute to sales.

The target is aggregate **portions**, not distinct order count, per completed
Monday–Sunday week in the Django application timezone. `history` also reports
distinct orders per week. Only paid, delivered orders are eligible; refunded,
cancelled, unfinished and invalid/future dates are excluded. The current partial
week is excluded from training. `forecast_week_start` identifies the full current
week forecast from the last completed week. `next_week_portions` is the one-step
forecast after that completed history, not a forecast for seven days from now.

Dates use `delivery_at`, falling back to the existing preorder `created_at` date
when missing. `estimated_date_orders` reports eligible orders using that fallback.
These are imputed reporting dates, not recovered delivery facts. No delivery
promises, preparation schedules, payment states or inventory are changed.
The sales analytics endpoints use this delivery-date basis too, and recognise
paid delivered sales rather than treating paid future bookings as realised sales.

Response fields include `source: LOCAL_KITCHEN`, `status`, `eligible_orders`,
`estimated_date_orders`, `excluded_orders`, `history_weeks`, `history`,
`selected_method`, `next_week_portions`, `candidate_model_trained`, `model`,
`evaluation`, and `warnings`. Empty eligible history returns
`status: insufficient_history` and a null forecast, not zero demand.

Generated-history provenance is additive: `local-forecast/` returns integer
`synthetic_history_orders` for eligible generated daily summaries, and
`recent_orders[].synthetic_history` is boolean. `local-decisions/` exposes
`decision_support.synthetic_history_items` and each menu's
`synthetic_history_items` as nonnegative item counts. These flags do not mean
real customers transacted. Warnings, replay UI and exported training records
identify generated history. A numerical evaluation can still run on synthetic
inputs; its result establishes no real-world accuracy. The UI excludes menus
with generated history from its evaluated-confidence count.

`/api/admin/analytics/` additionally returns
`analytics.synthetic_history_orders`, an all-time count of generated paid,
delivered daily summaries so sales totals/average order values can be labeled
as including artificial data. A daily summary is not a distinct customer order.

The local decision response also carries calculation evidence without changing
the forecasting or FEFO rules:

- Each menu's `demand_adjustments` contains numeric `delivery_day_excluded`,
  `lead_time_excluded`, `capacity_excluded`, and `recorded_orders_offset` portions.
  These are distinct, non-overlapping deductions from the full-window forecast.
  `additional_forecast_portions` is the remaining plan-eligible additional demand,
  not simply total forecast minus confirmed bookings. Recorded offsets can include
  unpaid requests to avoid counting their portions again.
- Each ingredient risk's `stock_flow` includes numeric `opening_quantity`,
  `confirmed_allocated`, `after_confirmed`, `forecast_consumed`,
  `projected_total_remaining`, `projected_expiring_unused`, and
  `projected_carried_stock`, all in its native unit. `batches` provide per-lot
  `batch_id`, `batch_code`, `raw_material_id`, `unit`, `expiry_date`,
  `opening_quantity`, `confirmed_allocated`, `after_confirmed`,
  `forecast_consumed`, `projected_remaining`, boolean `expires_in_window`, and
  nullable numeric `unit_cost`. `allocations` list forecast-use `date`,
  `batch_id`, `raw_material_id`, and numeric `quantity`.
- `opening_quantity - confirmed_allocated - forecast_consumed` equals total
  remaining stock; this separates into expiring unused stock and stock dated
  after the window. Forecast requirement equals forecast consumed plus forecast
  shortfall. Rounded API totals can differ by a small rounding amount.
- `review_reasons` is a string list of applicable history, provenance, coverage
  and dated-stock concerns; review cards no longer imply every possible concern
  applies to every ingredient.

Kitchen audit additions (2026-10-17, backward-compatible metadata):

- `menus[].evaluation.planning_horizon_test` has `horizon_days`, explanatory
  `strategy`, and `test` scores keyed by the existing three method names.
  Each score has integer `windows`, nullable `mae` (portions/day),
  `wape_percent`, and `window_total_mae` (portions/window). Origins run from the
  start of the final 14 test days through the last complete horizon. At each
  origin, predictions feed forward without observing outcomes inside the window.
  Windows overlap; these are descriptive, dependent replays. They do not select
  methods. The existing validation MAE still selects among three baselines only.
  Horizons longer than the test period return zero windows and null scores.
- Menu `confidence: evaluated` additionally requires a complete horizon test
  with defined WAPE at or below the existing 75% heuristic and at least seven
  selling days. This heuristic is not an accuracy guarantee or production
  acceptance threshold. Synthetic history remains explicitly labeled; it cannot
  produce a verified forecast-waste signal. Fictional `DEMO-FC-INV-` batches also
  suppress that signal. Confirmed stock gaps retain their operational meaning.
- `menus[].sensitivity_error_portions_per_day` is the numeric shift used in the
  lower/higher-demand what-ifs: selected one-day test MAE, or the largest daily
  forecast when unevaluated. These cases rerun constrained demand and FEFO;
  they are not calibrated probability bounds. Forecast values are unchanged.
- `stock_flow.expiry_focus` contains `opening_quantity`, `confirmed_allocated`,
  `forecast_consumed`, `projected_remaining` for eligible lots expiring within
  the window only, plus boolean `cost_known`. The first three quantities explain
  `forecast_expiring_unused` directly by subtraction.
- `stock_flow.demand_by_day[]` contains `date`, `forecast_requirement`,
  `forecast_consumed`, and `menus[]` with `product_id`, `product_name`,
  `additional_portions`, `quantity_per_portion`, `requirement`. Unrounded values
  show the exact menu → ingredient multiplication on each demand date. Summing
  requirements or forecast consumption matches the corresponding ingredient
  totals within display rounding. Confirmed recipe needs remain separate.

All of this is a read-only projected ledger: no stock movement or purchase is
recorded. Zero projected expiry waste can coexist with uncovered forecast demand.

Short histories use `moving_average_4_weeks` and `status: baseline_only`.
At 14 or more completed weeks, reserve the latest ceil(20%) for testing and the
preceding ceil(20%) for validation; at least eight earlier training weeks are
required. Compare moving average, last week, and ridge autoregression with fixed
regularization 10 and intercept/lag1/lag2/prior-four-week-mean features. Choose the
method by validation MAE only. Fit regression on train+validation for the test;
all test predictions use only actual earlier observations, so this is a rolling
one-week evaluation, not an unattended multiweek forecast. Report each method's
test MAE and WAPE (null when actual test volume is zero). Refit coefficients on
all completed history for production inference; saved coefficients can be used
with `myapp.services.kitchen_forecast.predict`.

The model artifact and prepared training records can be exported against the
configured kitchen database, without raw customer details:

```sh
python backend/manage.py train_kitchen_forecast --output work/kitchen-forecast.json
```

Use a new output filename for each run. The JSON contains aggregate history,
evaluation, fitted coefficients and `prepared_orders` with `preorder_date`,
`sales_date`, `sales_date_basis`, portions and order ID. Missing delivery dates
therefore have complete, explicitly marked dates in the training dataset. Files
are private (0600) and must stay outside Git. No trained-model accuracy on the
user's kitchen can be claimed until its populated database is available.

Missing calendar weeks are zero **recorded sales**, with recording coverage and
menu availability unverified. Demo orders remain demo evidence. Aggregate demand
cannot identify dish-specific ingredients; confirmed bookings still drive stock
planning, and forecast quantities must not be blindly added to them.


## Planner handoff: existing kitchen endpoints

The staff endpoint `POST /api/admin/orders/<id>/preparation-plan/` previews a
pending, unstarted, undeducted, non-refunded order using accepted settings by
default. `adopt_current: true` explicitly selects current recipe/preparation
settings. Optional `delivery_at` proposes a delivery change, with a required
`reason` documenting the agreed arrangement. Unchanged deliveries retain the
original notice basis; changed deliveries require fresh menu notice. Optional
`order_version` (the order's `updated_at`) rejects stale UI records with 409.

`find_next: true` and optional `search_from` instead search at most seven days,
checking hourly delivery times from 09:00 to 21:00 Malaysia time. The existing
order is excluded from its own equipment reservations and daily menu quota.
The shared scheduler enforces recipes, working hours, notice, preparation span,
handling limits, closures and other bookings. Impossible menu quantities or
weekday combinations stop early. No feasible time returns `{preview: null,
search: {from_date, through_date, reason}}` without a confirmation or mutation.
A found time returns the normal preview with search dates.

Success returns `preview` (including delivery, start, end, tasks and any adopted
recipes) and a signed owner/order-bound `confirm` token valid for ten minutes.
Confirmation sends only that token; the server uses its accepted choices and
rechecks order version and kitchen availability. Delivery and preparation are
saved atomically, with an amendment visible in delivery history when the date
changes. The UI requires the owner to acknowledge customer agreement for a new
time. Repeating an applied token returns the current order with
`already_applied: true`, without another amendment or reservation. This never
changes payment, order totals, progress or inventory quantities. No forecast is
accepted as an order. Planning reads use `Cache-Control: private, no-store`.

The separate delivery-change endpoint can reserve a feasible replacement plan
when its preview is confirmed. An infeasible unconfirmed request can instead
remain `needs_review: true` with no reserved tasks. Such requests are excluded
from planner delivery commitments, packing totals and calendar exports. See
[planner review](PLANNER-REVIEW-2026-10-20.md) for integration checks and limits.

## Customer delivery-time discovery: existing separate endpoint

`POST /api/orders/slots/` requires the customer's session and CSRF token. It reads
that customer's entire current basket and returns advisory times from the same
scheduler used by checkout; it does not reserve stock or capacity or run a model.
It is separate from the staff-only predictive endpoints above.

The storefront now sends `find_next: true`, optionally with a preferred ISO
`date`. Search starts no earlier than menu notice plus the delivery buffer and
checks at most seven days, returning the first matching day's hourly slots
(09:00–21:00 Malaysia time), `suggested_date`, `searched_from`, `searched_through`
and `searched_days`. Sending only `date` retains the exact-day diagnostic search.
Every returned `delivery_at` is checked again at quote/order submission.

Structurally impossible baskets return no slots, `searched_days: 0`, null searched
dates and `unavailable_code: quantity_limit` or `no_common_weekday`, with guidance
in `unavailable_reason`. These are successful constraint responses, distinct from
network/database failures. The UI can continue an empty bounded search from the
day after `searched_through`; it never treats a service failure as no availability.
See [delivery-time choices](DELIVERY-TIME-PICKER.md) for verified customer behavior.


## Order-bound escrow payment handoff

Sepolia escrow checkout is now available when explicitly configured.
`GET /api/payments/escrow/config/` exposes availability; authenticated
`GET/POST /api/orders/<id>/escrow/` creates fixed invoices and verifies chain
evidence before recording payment events. No forecast or browser transaction
claim alone becomes a paid order. See [implemented contract and setup](ESCROW-ORDER-INTEGRATION.md).


### Optional selling units and accepted contents (home-food batch 3)

Product list/detail and catalogue cards add `selling_details`, a JSON object with
`unit` (item, portion, box, pack, set, tray, jar or bottle), optional `size_label`
(60 chars), `contents` (500 chars), `no_substitutions` (boolean), and paired nullable
`serves_min`/`serves_max` integers (1–1000, min ≤ max). Fixed/no-substitution offers
require contents. Unknown keys/non-objects are rejected. `{}` clears details;
supplying a document replaces it, including on PATCH. Omission preserves it.
Writes retain staff permissions. New/old menus default to unspecified `{}`.

`POST /api/menu/suggestions/`, `POST /api/menu/guide/`, shopping assistant suggestion
rows and signed addition previews include current `selling_details`. Catalogue
update timestamps still invalidate stale signed shopping confirmations. Kitchen
`decision_support.menus[]` includes current selling details as display context.
`OrderSerializer.items[].selling_details` reads only the originally accepted
preparation snapshot, including when a product is deleted; legacy orders return
`{}`. Adopting current preparation/recipe settings preserves accepted selling
terms. No new customer substitution or order-unit amendment endpoint is added.

All quantity/price/recipe arithmetic counts selling units. Compatibility field
names containing `portions` are retained. Serving estimates and piece counts
inside a box do not multiply billable quantities, inventory use or forecasts.
Changing the physical yield of one unit requires a separate menu/history identity.
See [selling-unit setup and migration 0021](HOME-FOOD-SELLING-UNITS.md).


### Daily operations and seasonal enquiries (home-food batch 4)

No new schema migration or payment endpoint is added. Optional properties of
`Product.selling_details` are `ordering_mode` (`local_preorder` by default or
`shipping_enquiry`), paired `dispatch_from`/`dispatch_through` ISO dates (ordered,
maximum span 365 days) and `shipping_note` (300 characters). Enquiry mode requires
a window. These are dispatch information, never an arrival-time agreement.
Validation keeps legacy offer documents valid and serializes dates as JSON strings.

Enquiry-only products stay discoverable but are rejected from cart additions/
increases, assistant additions and new checkout/quote, including custom requests.
Older basket lines may still be reduced/removed. Local slot search returns no
slots and `unavailable_code: shipping_enquiry`; the date guide can return
`empty_reason: shipping_enquiry`. Dated suggestions/help exclude these offers;
instant recommendations include their metadata for the enquiry CTA. Explicit
shipping questions stay in `owner_review`. No enquiry sends a message or creates
a payment/order/reservation. Accepted local orders retain their existing terms.

Hourly search adds `unavailable_code: daily_capacity` for dated menu-quota
failures. Kitchen-time eligibility stays independent of ingredient availability.
`POST /api/orders/quote/` retains `procurement_required`; its stock preview skips
unconfirmed requests without preparation reservations while counting scheduled
unpaid bookings. No quote reserves stock. The private planning response excludes
enquiry-only offers from `setup_menus`. All other response keys remain compatible.

Kitchen `decision_support.menus[].demand_adjustments.shipping_enquiry_excluded`
explains raw forecast demand withheld from speculative local ingredient planning.
History/raw forecasts and confirmed accepted needs remain independent; no
forecast method is retrained or replaced.

Planner's collection/delivery runs are computed from its existing private order
response, retaining exact times and method groups. Packing excludes unconfirmed
or invalid/stale plans with an explicit review count. Owner financial queues
(`queue=unpaid`, `queue=cancelled`) are client-side views of the staff order list;
they add no public endpoint or access privilege and never change financial state.
See [batch 4 setup and limitations](HOME-FOOD-DAILY-OPERATIONS.md).

### Photo, size, tracking and shared-reservation extension

`POST /api/admin/menu-photos/` accepts a staff/session/CSRF-protected multipart
`image`. It validates/decodes still JPEG/PNG/WebP (4 MiB, at most 20 megapixels),
re-encodes metadata-free bounded WebP and persists it in `MenuPhoto` (migration
0022). Response 201 contains a portable `/api/menu-photos/<sha256>/` `image_url`,
width and height. Public GET serves WebP with ETag/conditional GET. Existing
external image URLs remain accepted; ProductSerializer also validates managed
relative paths against stored photo identities. No image byte/base64 is returned
in product JSON. Database backups include the image table.

Optional `selling_details.variant_group` is at most 80 characters. Products with
the same exact group and separate `size_label` values remain separate priced,
scheduled and forecast identities. Public `GET /api/products/<id>/variants/`
returns `group` and up to 20 active `results` with ordinary menu-card metadata.
No variant choice silently mutates an existing cart line.

Staff `POST /api/admin/orders/<id>/tracking/` accepts `carrier` (80 chars),
`reference` (100), optional public HTTPS `url` (500) and the order `version`
timestamp. Stale records return 409; pickup/cancelled orders reject tracking.
It audits and updates `fulfilment_snapshot.courier`, including `updated_at`.
Customers read this through their existing private order list. No carrier API,
booking, message, payment or progress update occurs.

Staff `GET /api/admin/shared-cooking/?date=YYYY-MM-DD` discovers compatible groups
among the first 100 pending orders on that delivery date. `POST` accepts distinct
`order_ids` (2–10), `mode` (`combine` or `separate`) and optional signed `confirm`.
A preview contains prior/proposed hands-on minutes, actual proposed tasks and
per-order intervals, plus an actor/selection-bound ten-minute confirmation token.
Confirmation recomputes under the kitchen/order/product locks, rejects changed
plans with 409 and applies/audits once even for simultaneous repeats. Orders must
be future, unstarted single-menu commitments with matching accepted recipes,
settings, delivery and dispatch buffer. Accepted ingredient/payment/quantity and
delivery records remain per order. Requests or mismatches cannot be merged.

`preparation_plan.shared_batch` identifies the common reservation and its original
order membership. Staff planning/order responses retain member IDs; customer
responses expose only its opaque ID and member count. Scheduler reservations,
agenda conflicts and calendar exports count the shared tasks once. Individual
time edits reject until a reviewed separation fits all active members, so a
member cannot silently free another order's reservation. See
[setup, migration and limits](HOME-FOOD-EXTENSIONS.md). Forecast/model methods and
the existing local planning API remain unchanged.

### Menu removal and form feedback correction

Staff catalogue/detail ProductSerializer responses add read-only `can_delete`;
public product/card responses omit it. DELETE on either existing product alias
still requires staff and session CSRF protection. Unused menus can be removed
with their current recipe/cart lines; raw materials and stock remain. Any order
reference returns HTTP 409 `menu_used_in_orders`, with an archive instruction.
Concurrent menu/cart updates return HTTP 409 `menu_busy` instead of waiting in
the inverse basket/menu lock order. Rejections roll back without partial removal.
No migration, forecast method or payment endpoint changes. See
[menu-management behavior and verification](MENU-MANAGEMENT-FEEDBACK.md).


## Customer reminder integration (2026-10-26)

Implemented outside predictive forecasting; forecast models and stock allocation
are unchanged. No migration is required.

- `GET /api/account/order-email/` (signed-in user): own `email` and SMTP/origin
  configuration `available` flag. Availability does not prove a running cron.
- `PATCH /api/account/order-email/`: `email` (valid or blank) and `current_password`;
  updates only the current account, with password verification and rate limiting.
- `POST /api/orders/{id}/reminder/`: own future open order, Boolean `enabled`.
  Recipient is always the account email; client-supplied recipients are ignored.
  Stores consent only; it does not confirm a requested time or reserve tasks.
- Checkout accepts optional Boolean `email_reminder` (default false), snapshotted
  with the account email in `fulfilment_snapshot.customer_reminder`.
- Staff `GET /api/admin/reminder-status/` additionally returns
  `customer_email_configured`, `customer_reminders_due` and
  `scheduler_activity_verified: false`. Existing owner configuration fields stay.
- Existing bearer-authenticated `GET /api/reminders/run/` handles both queues,
  returning shared `sent`/`failed` counts with at most three attempts/run. Customer
  sends require consent, a matching current account email, active account,
  reserved preparation and a confirmed future time within two hours. Successful
  dated-recipient receipts avoid routine repeats across overlapping workers.

See [Customer delivery batches](customer-delivery-batches.md) for scheduler setup,
retry limits, implemented handover/arrival-window contracts and remaining provider
work. The sections below distinguish implemented endpoints from future setup.


## Handover and dispatch integration (2026-10-26, Batch 2)

- Checkout accepts optional `handover`: `contact_phone`, `contact_method`
  (`phone`/`whatsapp`), `mode` (`in_person`/`agreed_place`), `location`, `notes`.
  Explicit drop-off requires a location; collection permits only in-person
  handover. Phone numbers are normalised; choosing WhatsApp requires a valid one.
- `PATCH /api/orders/{id}/handover/` is limited to the buyer, before dispatch/closure.
  Body: `version` and `handover`. Stale versions return 409. Changes are audited and
  do not update scheduling, payment, stock or address.
- Owner courier tracking accepts optional `contact_phone`, visible only in staff
  order payloads. Customer serialisation removes that field and private dispatch
  metadata. Saving tracking never dispatches or books a courier.
- Checkout optional Boolean `email_dispatch_updates` requires `email_reminder`.
  The reminder preference endpoint accepts optional Boolean `dispatch_updates`;
  existing reminders remain unsubscribed unless explicitly selected.
- The first actual owner status transition to `shipped` queues a dispatch notice.
  The existing cron sends it asynchronously under the shared three-attempt limit,
  current recipient/consent/status checks and duplicate protection. Queued notices
  older than 24 hours are excluded. No automatic dispatch/delivery is inferred.
- Owner reminder status adds `customer_dispatch_due`. Scheduler activity is still
  unverified by the application. The optional GitHub scheduler requires a private
  repository secret and explicit enablement; see the batch guide.

No migrations or model/forecast changes are required. Arrival windows and email-first
registration are implemented in the later sections below. Google/phone sign-in and
provider messaging remain future work.


## Accepted arrival windows and owner driving blocks (2026-10-26, Batch 3)

No database migration and no forecast/model/training changes. Kitchen demand and
expiry projections retain the accepted delivery calendar date.

- Quote, place and basket-slot inputs accept `arrival_window_minutes`: integer
  `0`, `30` or `60`, default `0` for backward compatibility. Pickup requires `0`.
  `delivery_at` is the latest-arrival deadline. Nonzero windows must start in the
  future and fit wholly within delivery hours on the same Malaysia calendar date.
  Scheduling still targets the deadline minus the accepted delivery buffer.
- Quote responses and slot entries expose `arrival_window` as `{start,end,minutes}`
  or `null` for a point time. Slot responses echo `arrival_window_minutes` even
  when empty. `start`/`end` are ISO datetimes; `end` equals `delivery_at`.
- Order serialization adds that same `arrival_window`, plus `dispatch_by` (ISO or
  null). Dispatch requires confirmed preparation and a recorded nonnegative
  buffer. Accepted JSON stores `arrival_window_minutes`; old missing values mean
  zero and never convert historical bookings. No arrival/traffic guarantee is
  implied by the range or dispatch target.
- Customer reschedule and staff preparation-plan previews accept the optional
  duration, preserving accepted terms when omitted. Signed confirmations include
  the duration/range and recompute availability. A same-deadline duration change
  is a real change requiring a reason/customer agreement; history includes
  `previous_window` and `arrival_window`. Price, address and stock remain unchanged.
  Existing escrow invoices prohibit changing either deadline or duration.
- Checkout `email_time_updates` requires `email_reminder`. The own-order reminder
  endpoint accepts `time_updates`; default false. Preferences are tied to the
  current account email. Confirmation of a previously unconfirmed request or an
  accepted time/window change queues a private `time_notice` in existing JSON.
  Nonstaff order responses remove this worker metadata. The worker rechecks
  recipient/consent/active confirmed order, expires queued notices after 24 hours
  and records successful receipts. Staff reminder status adds
  `customer_time_updates_due`. Existing SMTP budget/retry/locking rules apply.
- Advance customer reminders are eligible within two hours **before window
  start**; old point-time receipt keys remain unchanged. New window keys include
  duration, so changing accepted ranges is not confused with an old send.
- Owner driving UI posts entered start plus calculated end to the existing staff
  kitchen-block endpoint. Duration is 1–720 whole minutes, including return.
  These independent blocks reserve all work/equipment and use existing conflict
  checks. They are not courier bookings or automatic order-linked reservations;
  changing an order does not automatically delete or move a driving block.
- The handover board groups by range start; overdue uses range end. Calendar
  events span ranges. Self-collection remains a point time and has no driving UI.

See `docs/customer-delivery-batches.md` for deferred live setup and remaining
account/provider batches. Tests use isolated databases and mock SMTP; they do
not establish live scheduler operation or courier arrival accuracy.


## Email-first account endpoints (2026-10-27, Batch 4A)

This account batch changes no model, predictive algorithm, forecast, stock or
payment schema. No migration is required; existing user IDs/usernames remain.

- `POST /api/signup/`: public UI supplies required `email`, optional `first_name`,
  `password` and `confirmPassword`. An email-first account receives a random stable
  internal username. Legacy clients can still supply `username` and optional email.
  Missing both identities, invalid/weak passwords, mismatch and collisions return
  400. Privilege fields cannot create staff/superusers. Successful signup returns
  201 and establishes the normal CSRF-protected session.
- `POST /api/login/`: `identifier` (max 254) plus password accepts email or username
  only when exactly one existing account matches. Email comparison is case-insensitive;
  usernames remain exact/case-sensitive. Legacy `username` (max 150) explicitly
  authenticates that username. Sending both/neither returns 400. Ambiguity, invalid
  password, unknown and inactive accounts all return the same generic 401; no account
  candidate list or email address is returned. Known aliases share one account limit.
- `POST /api/auth/recovery/`: email, optional username. Email-only requests require
  one account across active/inactive legacy rows; the selected account must be active
  and have a usable password. Optional exact username disambiguates shared mailboxes.
  The public response remains generic and does not establish that a mail was sent.
  Alias attempts share the recovery limit. Existing reset-confirm endpoint/token
  expiry/single-use semantics stay unchanged.
- `PATCH /api/account/order-email/` still requires the current password. Changed
  emails are normalised and collision-checked; unchanged legacy duplicate emails
  are not silently rewritten. Existing account reference and order opt-ins stay.
- Public signup and email changes use the existing kitchen singleton row lock to
  serialize case-insensitive collision checks against `User.email` and usernames.
  This adds no database-wide email constraint; direct SQL/import/admin changes
  must respect the same policy. Existing duplicates remain username-accessible.
- Registration does not send mail or set a verified-email badge. Persistent email
  verification, OAuth identity linking and phone verification remain future work;
  no caller should interpret email/password login as proof of mailbox ownership.
  Live SMTP/scheduler/provider setup remains deferred by user preference.

See `docs/customer-delivery-batches.md` for implemented and deferred work.


## Mailbox-confirmed email changes (2026-10-27, Batch 4B)

Implemented with an opt-in rollout flag, default **disabled**. No migration,
forecast/model, stock, payment or order-consent changes. Configuring this flag
never enables the order-reminder cron.

- `ACCOUNT_EMAIL_CONFIRMATION_REQUIRED=1` requires confirmed mailbox changes.
  Keep `0` while live setup is deferred. Existing direct password-confirmed edits
  remain compatible in disabled mode. In required mode, old PATCH attempts to
  add/replace a nonblank email return 400 with confirmation guidance; same-address
  edits and password-confirmed removal remain allowed. Removal/password reset
  invalidates outstanding challenges.
- `GET/PATCH /api/account/order-email/` adds booleans
  `email_change_confirmation_required`, `email_change_available` (configuration
  only, not inbox verification) and `email_change_pending`. No pending recipient
  or confirmation credential is returned. The existing `email` is always the
  currently saved address and `available` remains reminder configuration status.
- `POST /api/account/email-change/`: authenticated CSRF-protected request with
  `email` and `current_password`. Nonblank, different, unclaimed address required.
  At most five requests/account/15 minutes plus the existing IP limit. Needs
  required mode, SMTP and a trusted public origin. Successful provider acceptance
  returns 202, current email settings and `confirmation_sent:true`; it does not
  save the email or expose a link/token. Unavailable/failed sending returns 503,
  invalidates that challenge and leaves the current email unchanged. SMTP occurs
  outside locks and is never called during confirmation/cancellation.
- `POST /api/account/email-change/confirm/`: `token` (max 4096) and `action`
  (`inspect`, default, or `confirm`). Only the signed-in account owning the signed
  request can inspect the proposed address. Inspect returns `current_email`,
  `proposed_email`, `already_applied` and makes no email change. Explicit confirm
  checks token age/state/latest request, user lock and final email collision lock;
  returns current settings and `already_applied`. Retries do not mutate twice.
  Wrong-account results reveal no proposed recipient. Invalid/expired/replaced/
  cancelled tokens return 400. Confirmation attempts are rate-limited separately.
- `POST /api/account/email-change/cancel/`: same-account authenticated CSRF-protected
  action. Invalidates outstanding links, returns settings/current address and never
  sends. Cancellation is separately rate-limited. No GET route mutates email.
- Tokens last 30 minutes and carry a HMAC state proof instead of a raw password
  hash. Purpose-separated hashed challenge/receipt records use existing
  `AuthAttempt` storage; its one-day cleanup cannot outlive a valid link. Only the
  newest request works; receipts are checked under the user lock. Direct imports
  and admin/SQL writes still need to preserve the application email uniqueness rule.
- Browser route `/confirm-email#token=...` gates inspection on sign-in, preserves
  the fragment across sign-in/account switching, strips it after valid inspection
  and requires an explicit save. No token is stored in local/session storage or
  returned by request/cancel APIs. Request Host never supplies a mail origin.

The rollout verifies mailbox access for a particular change. It does not create a
persistent signup verification marker, link Google identities, transfer reminder
subscriptions or make courier/scheduler setup live. See the customer delivery
batch guide for setup and remaining provider work.


## Read-only reminder worker observations (2026-10-27, Batch 5)

No migration, predictive model, stock allocation or payment contract changes.

- Staff-only `GET /api/admin/reminder-status/` now includes `worker_activity`:
  `generated_at`, `retention_hours:24`, `recent_threshold_minutes:15`,
  `authenticated_runs_24h`, `recent_runs` (newest start first, at most 10).
  Existing configuration/queue fields remain. Refresh is read-only and sends no mail.
- Each observed row has `started_at`, `completed_at` (ISO or null), `outcome`,
  `sent` and `failed` (bounded 0–3 integers or null when unknown/unattempted).
  Outcomes: `running`, `incomplete`, `completed`, `send_failed`,
  `not_configured`, `worker_error`. No completion after two minutes is incomplete,
  not a claim that mail failed. A completed zero-attempt run does not prove the
  queue is empty; locked or already-handled work can also yield zero.
- Only a valid bearer request to the existing HTTP worker creates activity.
  Unauthorized requests, CLI preview/send commands and status reads do not.
  Manual authorised HTTP calls are included, so `scheduler_activity_verified`
  remains **false**. Observations cannot establish an automatic scheduler is enabled.
- Activity uses purpose-prefixed start/completion markers in the existing
  `AuthAttempt` table, including only run IDs, timestamps and bounded aggregate
  counts. There are no bearer values, recipients, order identities or mail content.
  Worker cleanup affects only its own expired markers. Existing daily auth cleanup
  and 30-minute email-change challenges remain compatible. Run identity keeps
  overlapping starts/finishes distinct; status reads are bounded to three queries.
- Monitoring is best effort and isolated in savepoints: a marker-write failure
  does not change SMTP/notification receipts or convert success into a retryable
  error. Unexpected worker exceptions return sanitized HTTP 503, record an error
  when possible and log only a safe exception type. Normal response counts and
  the existing three-attempt budget remain unchanged.
- The monitor renders Malaysia times, current customer queues, recent calls,
  failed/incomplete/stale evidence and retryable read errors. It contains no
  button to invoke a sending endpoint. GitHub execution history remains the place
  to inspect the actual configured schedule.

This completes the planned delivery/email **code** batches. Live SMTP/scheduler
setup and email-confirmation rollout remain deferred, not silently enabled.
Optional Google/phone identity, mandatory signup verification and automatic
WhatsApp/GrabExpress integrations still require separate development/provider access.
