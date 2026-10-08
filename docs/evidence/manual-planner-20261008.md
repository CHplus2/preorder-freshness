# Owner-controlled preparation windows

## Scope

Planner now has an Awaiting confirmation view with a count across all dates.
Pending requests remain there until their plan is confirmed or they are cancelled.
Owners can set a preparation start/end and reason for an unplanned order, or replace
a pending order's generated task breakdown with a manual overall window.

The preview discloses overlapping orders, blocked periods and work across days or
outside kitchen hours. The owner confirms explicitly. The entire interval reserves
the worker and kitchen resources, including overnight gaps; it is not a split-step
schedule or a verification of food-handling suitability. Future start, end after
start, a maximum 30-day interval and finishing before the delivery buffer are enforced.

Previous plans are kept in OrderAmendment records with the actor, timestamp and
reason. The editor exposes recent history and previous task times. Signed previews
expire after ten minutes and are tied to the owner, order and current order version.
Changed conflict warnings require another preview. Repeating a saved confirmation
does not create another amendment. Only staff may use the endpoint; only pending,
uncooked orders can be edited.

Saving removes a request from Awaiting confirmation and puts its reservation in the
calendar and daily tasks. It remains pending until actual preparation starts.
Customers see Kitchen confirmed for a manually confirmed pending order. Moving an
unplanned order directly to Processing is now rejected with guidance to use Planner.
No payment or delivery date is changed. No database migration is needed.

## Verification on 8 October 2026

- Full isolated SQLite backend suite: 200 tests run, 198 passed, 2 skipped.
- ESLint and Vite production build passed.
- Local browser: synthetic order #5 appeared in Awaiting confirmation (1).
  Previewed and confirmed 12 October 2026, 10:00–12:00 Malaysia time. Its requested
  delivery remained 17:00. The queue count became zero, the calendar showed one
  task and daily tasks showed two hours reserved at the saved times.
- Browser inspection at the available narrow viewport showed the agenda card's
  spacing and controls without overlap. This is not an exhaustive device matrix.
- Local test DB only; no production orders were created or modified.

## Remaining scope

Editing individual generated recipe steps is not part of this batch. Replacing a
task plan with an overall window is explicit in the UI. Started/completed orders
cannot have their plan rewritten. Overlap/working-hour warnings require owner
judgment; the software does not certify recipe safety or automatically move other
orders. Production deployment has not been browser-verified.
