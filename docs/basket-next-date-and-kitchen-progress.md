# Next-date delivery search and simpler kitchen progress

## Delivery suggestions

A menu's existing `lead_hours` remains notice **before preparation starts**.
Delivery also needs recipe time and the configured delivery buffer. For example,
an order at 15:27 on 19 October with 24-hour notice cannot start preparation
before 15:27 on 20 October. Selecting today does not make that window possible.
No menu policy, holding limit, capacity or customer database record is changed.

`POST /api/orders/slots/` still supports `{ "date": "2026-10-20" }` for a single
Malaysian calendar date. It also accepts `{ "find_next": true }`, with an optional
`date` to start from. The search begins on the later of that date, today, and the
notice-plus-buffer lower-bound date. It checks at most seven calendar dates and
never goes beyond the existing 90-day booking window. Hourly candidates remain
09:00–21:00 inclusive; the first day with a feasible complete-basket plan wins.
An empty search does not establish that every possible manual/minute-level plan
is impossible. Quantities above a daily limit and incompatible recipe finish
rules cannot be solved merely by changing the date.

Response fields:

- `slots`: existing delivery/preparation timestamps and hands-on minutes.
- `unavailable_reason`: last scheduler validation when empty, otherwise empty.
- `unavailable_code`: retained for response compatibility; currently empty.
- `earliest_preparation_at`: notice lower bound, not a promised cooking slot.
- `delivery_request_after`: notice plus buffer lower bound; recipes still need time.
- `suggested_date`: Malaysian date of returned slots, or null when empty.
- `searched_from`, `searched_through`: checked calendar range; null if the notice
  already exceeds the booking window.
- `searched_days`: number of dates checked (0–7; 1 for a single-date search).

The UI labels any newly suggested date before presenting times. Selecting a slot
updates the basket date/preferred checkout time. The next-day action also works
without a preferred date, or when the selected date is an incompatible weekday.
No-common-weekday baskets remain for review. Date/basket changes cancel old
requests and reset old results. Suggestions never create an order or reserve stock.

Each date uses three read queries for current bookings and kitchen blocks,
shared by its hourly checks. This is a request-local advisory snapshot. Normal
quote and checkout calls do not reuse it; checkout retains its existing locks
and rechecks current capacity. Unexpected/database failures remain errors.

### Adaptive finishing and delivery requests

`max_early_minutes: 0` now means **flexible finishing on the dispatch day**.
Final steps can finish at different times after kitchen opening and before
`delivery_at - delivery_buffer_minutes`. A completed meal does not reserve worker
or equipment capacity while waiting for dispatch. Positive values remain explicit
finish limits. Zero does not permit a previous-day final finish; a positive
allowance must permit that. Preparation span, task order, zero waits between
steps, approved pauses, working hours and existing reservations still apply.

For example, with 18:00 delivery and a 90-minute buffer, one menu can finish
packing at 16:15 and another at 16:30. The zero setting no longer requires both
packing steps to end at 16:30. The menu editor presents **Flexible on the dispatch
day** and **Limit how early food may finish**, instead of requiring the owner to
infer the meaning of zero. Existing values of zero use this behaviour for new
plans and explicit replans; saved tasks are not silently moved.

The reported ten-cookie-pack plus one-brownie-box basket is covered with its
actual multi-step, two-cookie-batch timings. It can now receive a feasible plan
without editing either menu's zero finish value. Twelve cookie packs still exceed
the example's automatic daily limit of ten, but checkout can submit a review
request rather than rejecting it as an impossible order.

Checkout's quote/place endpoints opt into `allow_request_exceptions`: insufficient
advance notice or automatic daily capacity creates `needs_review: true`, null
preparation timestamps and no tasks. These requests are unpaid (wallet/manual
choices fall back to COD) and have no reserved daily capacity. Suggestions and
owner replan/maintenance commands keep strict notice and quota checks. When
checking capacity, unaccepted `needs_review: true` orders are excluded; accepted,
started and delivered records still count. The locked checkout scheduler performs
the capacity check, without a second contradictory rejection after review routing.

Past dates, inactive menus, unavailable delivery weekdays, dates beyond 90 days,
and delivery outside 09:00–21:00 remain invalid. The checkout date input allows
future short-notice requests, labels automatic notice separately and explains
that owner review is needed. Request submission is not kitchen acceptance.

Kitchen working hours govern automatic preparation; the separate existing
09:00–21:00 delivery window can extend beyond cooking hours. For example, an 18:00
delivery can use food finished by a 16:00 kitchen close. The owner may edit
individual task times or set a manual preparation window in Planner, preview
conflict/handling warnings, and explicitly confirm with a reason and audit trail.
This is the existing owner-controlled exception path; the automatic solver does
not silently ignore equipment, worker or storage conflicts. No database migration
or maintenance terminal command is required for this change.

## Orders are already planned while not started

New orders with a valid automatic schedule are created as `pending` and reserve
their saved task slots. Planner already includes pending and processing orders;
there is no requirement to mark them processing to make them appear. Orders
requiring manual review have no automatic preparation reservation until reviewed.
Choose the preparation or delivery date in Planner to see its day's work.

A home-kitchen owner can now use two actual-completion updates directly from
Planner's day view or order cards:

1. **Mark ready for delivery** (`pending` or `processing` → `cooked`). A pending
   request must have a confirmed, valid preparation window. Existing recipe/FEFO
   consumption runs transactionally and once; missing recipes or insufficient
   stock leave the order and stock unchanged.
2. **Mark delivered** (`cooked` or `shipped` → `delivered`). This records actual
   receipt and does not mark an unpaid order paid.

**Start preparation** and **Out for delivery** remain optional progress updates.
An order cannot jump directly from unprepared to delivered. Requests needing
preparation review cannot use the pending-to-ready shortcut. Staff permissions,
row locks, idempotent stock deduction and verified payment-record requirements
remain enforced. The system never assumes cooking/delivery occurred just because
its scheduled time passed. No existing orders are modified by deployment.

Planner refreshes after an action and reports service/stock validation errors.
Customer-facing order progress continues to use the same existing status values.
Payment receipts and refunds stay in Payment records.

## Verification

Regression coverage includes the reported notice-time boundary; next-date search
with/without a preferred date; weekday and closure exclusions; seven-/90-day
bounds; daily quantity limits; a three-query daily snapshot equivalent to fresh
hourly scheduling; and checkout rejecting a new conflicting booking. Workflow
coverage verifies automatic pending-order visibility, two-update completion,
optional stages, staff access, reviewed-plan guards, shortage rollback,
exactly-once inventory use and unchanged unpaid status.

## One delivery choice through checkout

The basket has one primary **Find delivery times** action. With a preferred date,
it checks that day. Without one (or when that weekday is unavailable), it searches
for the next available day. **Search later dates** appears only after a selected
day returns no suggestions. A new result replaces the earlier failure, and each
time is an alternative for the same basket, not another required delivery.

Checkout carries forward the selected timestamp. It automatically calls the
existing quote endpoint once a complete date/time and current basket are ready,
with a short debounce while editing. The normal **Check availability** button has
been removed. **Find another time** holds the optional suggestion search, collapsed
by default. Customers can still enter an exact request or search from a blank date.
Selection changes are saved for navigation back to checkout when browser storage
is available.

The quote check asks whether the exact selected time fits the whole basket; the
suggestion search finds candidate times. Neither reserves stock or tasks. Actual
order placement retains its locked backend recheck. Date/basket/policy changes
invalidate the previous quote immediately and cancel its request; late responses
cannot show availability for an older selection. Submission waits for the current
check, and a failed/invalid response cannot leave an old success visible. Service
failures provide a retry; a review result uses **Send for kitchen review**.

Frontend utility and component checks, targeted lint and the build pass. Real
local API browser checks cover one basket finder, failure-to-later-date recovery,
selection transfer, automatic quote, cancelled stale replies, outage/invalid-data
retry, optional checkout search, changed basket quantities and 1440/390/320px
layouts. Only isolated fixture basket quantities were changed; no orders were
placed in this UI batch. Backend scheduling and payment logic are unchanged.

## Unconfirmed requests and owner follow-up

A review-only checkout creates an order record for tracking, not an accepted
preparation reservation. Customer cards and checkout notifications now say
**Delivery request sent**, **Requested delivery**, and explicitly state that no
preparation slot is reserved. The no-payment claim appears only for unpaid
records, so older paid requests do not get a contradictory message.

Planner readiness separates unconfirmed delivery requests from existing saved
plans that need repair. A missed saved preparation start (such as an order left
pending after its planned start) is a separate follow-up, not an automatic
failure of the new delivery request. Request cards expose **Change requested
time** directly; the owner can offer another delivery time or use the existing
manual-plan preview/confirmation workflow. Past-due records still need an actual
completion, revised arrangement or closure, rather than an invented delivery.

The existing delivery-change API now identifies an `unconfirmed_request` only
when the order is pending, has a requested delivery date, `needs_review: true`,
no preparation timestamps/tasks and no deducted inventory. Its GET policy has
`unconfirmed_request: true`, `eligible: true` and `cutoff: null`: no preparation
reservation exists for the 24-hour cutoff to protect. Actor access, refund and
started-work guards still apply. Existing reservations retain their 24-hour
cutoffs, including when a review flag is present alongside saved tasks.

A customer or owner can preview another future time for such a request. A time
that still cannot be automatically scheduled remains unpaid/unreserved and
requires review; a feasible new time can receive a checked preparation plan.
The preview adds `unconfirmed_request`; `change_closes_at` is null only for an
unconfirmed source whose proposed result still needs review. Confirmation stays
actor-bound, signed, version-checked, revalidated and idempotent, with audit
history. Items, money, payment status, recipes and stock are not rewritten.

Verification: 62 targeted Django checks pass, including the near-cutoff request,
owner/customer changes, retained pending review, existing-reservation guards,
manual acceptance, payment/inventory invariants and audit retry. Frontend tests,
component checks, lint and build pass. Authenticated local browser verification
covers a nine-cookie-pack plus one-brownie request with a ten-percent bulk
reduction (RM108.00 minus RM10.80 = RM97.20), customer amendment, separate Planner
queues and owner acceptance of a feasible later time at desktop/390/320px widths.
Only isolated fixture records changed. No live order or migration was applied.

## Adaptive scheduling verification

The full Django app suite passes (395 tests; four environment-specific tests
skipped). Regression cases cover mixed-menu sequential packing, the detailed
cookie/brownie basket through checkout, explicit positive finish caps, blocked
kitchen periods, existing bookings, no backdating, permitted multi-day work,
delivery after cooking closes, unpaid short-notice/over-capacity requests,
wallet non-debit, unreserved review quantities, accepted daily quotas, owner
manual confirmation, audit history and unchanged ingredient deduction.

Frontend utility, checkout/editor and Planner checks and the Vite build pass.
Authenticated local browser checks verify the actual bakery API response,
short-notice request submission, visible owner controls, policy selection and
1440/390/320px layouts. These checks only modify isolated SQLite fixtures. The
legacy catalogue import now sends the API's explicit pause defaults so its
existing save-verification/idempotency checks match the current recipe schema.
