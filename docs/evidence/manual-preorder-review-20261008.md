# Manual review when preparation cannot be planned

Requested change: stop rejecting checkout solely because the automatic recipe
scheduler cannot place the preparation steps.

## Behaviour

- Checkout and its availability preview retain date, delivery-day, selling-status,
  advance-notice and daily-capacity validation.
- Recipe/planning validation failures produce an unpaid pending order with
  `preparation_plan.needs_review=true`. Preparation dates remain null and the task
  list stays empty. Unexpected/database errors still fail the request.
- These requests use cash on delivery. Neither wallet credits nor a payment receipt
  are created. Checkout explains this before submission; My orders shows
  "Awaiting kitchen confirmation".
- Owners review the planning explanation in Orders. Moving to Processing records
  the owner's identity/time in the plan and an OrderAmendment. It is manual
  confirmation, not an automatically verified task schedule.
- Pending review requests can preview and confirm a delivery change with the
  existing signed, expiring, idempotent confirmation flow. Their change deadline
  is 24 hours before requested delivery while no preparation time exists.
- Unscheduled manual requests are excluded from dated ingredient allocation
  estimates. Owners must review ingredients separately until a dated plan exists.
- Exactly 21:00 Malaysia time is now accepted, matching the checkout label.
  Checkout also displays the full earliest date/time to reduce date-format ambiguity.

## Verification

Isolated SQLite tests with dotenv disabled; production data was not used or changed.
Tests cover an infeasible multi-menu basket, an uninterrupted step longer than a
working day, unpaid COD fallback, no wallet debit/receipt, duplicate submission,
owner confirmation/audit, review-request rescheduling, capacity/selling validation,
21:00 versus 21:01 and a simulated database outage.

The backend suite before the final rescheduling additions ran 191 tests: 189 passed,
two skipped. Targeted account/wallet and rescheduling tests after those additions:
26 passed. Final account/wallet, planning and rescheduling regression run: 55 passed.
Checkout component rendering tests include the review state without an
availability claim or invented preparation time. ESLint and production build passed.

## Limits

No migration is needed; existing JSON and nullable preparation fields are used.
Existing orders are not rewritten. Automatic plan approval remains strict.
Manual confirmation does not split cooking steps, reserve worker/equipment time,
or establish food-handling suitability. Owners must consider unscheduled requests
alongside the generated planner. No live order or browser layout test was performed
for this batch; deployment and real business operation remain separate verification.
