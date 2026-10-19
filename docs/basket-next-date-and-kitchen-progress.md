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
- `unavailable_code`: `simultaneous_finish` when two basket recipe lines require
  their final steps to end exactly at dispatch but share the single worker or
  the same equipment. Otherwise empty (older/booking-window responses may omit it).
  This is a basket-internal conflict, independent of bookings; search stops as
  soon as it is established instead of trying more hours/days. Ordinary search
  failures still use the bounded date search. Checkout reports the same reason
  and can accept a manual-review request, without reserving a plan.
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

### Bakery basket timing review

The manual-entry example sets both cookies and walnut brownies to zero early
finish, with attended packing as the last step. Both would need the one worker
and packing area to finish at the same dispatch instant. Extra dates, a longer
preparation span, or a longer notice period do not resolve that contradiction.
For example, for an 18:00 delivery with a 90-minute buffer both final steps must
end at 16:30; two positive-duration packing jobs cannot both end then.

The owner can review each menu in **Menus → Edit → Recipe & preorder settings →
Preparation across days → Finished batches may be ready early by (minutes)**.
Use an allowance justified by the actual process, then review any necessary
**Allowed wait before the next step** settings. Zero wait requires consecutive
steps. A nonzero allowance may make scheduling possible; the scheduler must
still check every step, resource, working hour, notice period and daily limit.
There is no universally safe value and this change does not alter catalogue
settings, existing bookings or database records. Twelve cookie packs also
exceed the example's daily maximum of ten; that is a separate constraint.

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
