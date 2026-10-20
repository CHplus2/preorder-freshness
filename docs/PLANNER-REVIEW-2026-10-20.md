# Planner review — 20 October 2026

## Reported request

A requested delivery at **20 October, 16:00 Malaysia time** cannot use preparation
whose earliest allowed start is **20 October, 19:46**. With the accepted 24-hour
notice, this corresponds to the order being placed on 19 October at 19:46.
Cooking and the 90-minute delivery buffer require additional time. The
calculation must reject this time rather than backdate preparation or overwrite
another reservation. The regression test fixes the clock before that delivery
and reproduces the exact notice message without reserving any tasks.

Owner replanning measures notice from the order's original creation time; it
does not restart 24 hours of notice on every calculation. A delivery change
checks fresh notice. The accepted preparation settings remain in use unless the
owner selects current settings and confirms the change.

**Recovery:** open the order's delivery-time review and agree a later time. If
its new preparation plan fits, **Confirm new time** saves that delivery and its
reservation together. If it does not fit, **Save requested time** leaves a request
with no reserved preparation. **Calculate plan → Confirm preparation plan** can
accept a request once its time and settings permit a plan. The manual arrangement
remains an explicit owner-reviewed exception, including any displayed conflicts
or handling warnings; it is not the normal acceptance step.

## Defects fixed

- Unconfirmed delivery requests were counted as scheduled deliveries in the
  daily/monthly calendar, exported as delivery commitments and included in
  packing quantities. They now have separate request counts and are excluded
  from packing and calendar downloads until scheduled. Requests remain visible
  for owner follow-up.
- Repeating an automatic-plan confirmation after a lost successful response
  produced a stale-preview error. Signed confirmations are now bound to the
  owner, order and request identity; repeating one returns the current order
  without another reservation, recipe replacement or amendment. The frontend
  retains confirmation after an uncertain network/server response. New changes
  to availability or accepted terms still require a fresh preview.
- Invalid stored task dates could crash the closed manual editor and prevent
  the planner from rendering. They now leave the recovery controls available.
  Calendar export skips invalid task timings and reports the omissions.
- Navigation to another planner query on the same route could retain the old
  tab/date. Explicit query navigation now loads its requested planner view.
- Array-shaped automatic/manual-plan and delivery-change payloads now return
  validation errors instead of server errors.
- Narrow-screen calendar counts now use a visible T/D/R legend and compact
  counts, with complete task/delivery/request counts in each day's accessible
  label. Calculation failures link directly to the affected order.

## Verification

| Area | Evidence |
| --- | --- |
| Notice, dates and recipes | Same-day rejection; no preparation before placement/notice; future/date/weekday/capacity limits; accepted versus explicitly adopted current recipes |
| Automatic capacity | Worker and equipment exclusion, unattended overlap on different equipment, existing bookings and whole-kitchen closures, independent batches |
| Multiple days | A 1,000-minute preparation task spans two working days with a bounded, reserved fridge pause; cooking remains uninterrupted; step dependencies and waiting limits remain enforced |
| Confirmation | Preview is read-only; stale availability is rejected; owner/order binding; retry after success/after work starts cannot restore an older plan |
| Concurrent writes | Two simultaneous confirmations save one amendment and one reservation under actual PostgreSQL row locks |
| Manual work | Shift saved steps by entering a new start; finish is calculated; individual-step identities/durations/resources remain; advanced whole-window and conflict warnings retain existing semantics |
| Requests and exports | Separate calendar counts, no unconfirmed packing quantities or calendar commitments, UTC calendar timestamps, corrupt-task recovery |
| Operational progress | Scheduled pending orders appear without a processing update; ready deducts stock once; optional dispatch and receipt update work; payment is separate |
| Browser | Actual local API/session/CSRF flow, impossible request, feasible reschedule, simulated lost response after server commit followed by retry, multi-day plan, manual shift, closure add/reject/remove, downloaded calendar, packing and progress; 1440/390/320-pixel widths |

The full backend suite passed **532 tests**, with **11 skips**: nine PostgreSQL
checks run separately against disposable TLS PostgreSQL, plus two checks requiring
the original model artifact. All **nine PostgreSQL checks** passed. Frontend
utility, planner, checkout and UX suites and the production build passed. The
browser fixture verifies one automatic amendment after the simulated response
loss, one manual amendment, one delivery amendment, one ingredient deduction,
unchanged unpaid status and the two-day plan's full 1,000 work minutes. Final
Chromium checks at all three widths report no page errors, horizontal document
overflow or automated WCAG A/AA findings in the planner views. Search-only
navigation changes the tab/date without a document reload; a simulated refresh
outage hides stale actions and retry restores them.

## Practical limits

The scheduler uses a bounded greedy search, not a global optimizer. A rejected
automatic plan is not proof that no owner-designed arrangement exists. Multi-day
work requires configured preparation spans, waits and appropriate pause/storage
rules; increasing the span alone does not make every recipe or quantity fit.
Manual confirmation can accept clearly displayed exceptions and is therefore
not a guarantee of conflict-free capacity or safe holding.

These checks use isolated fictional data, not the deployed Supabase records.
No customer's order, delivery, payment, stock or menu settings were changed.
Deployment readiness and the actual future progress of an order require checking
the running website and owner records; tests do not confirm food was prepared.
