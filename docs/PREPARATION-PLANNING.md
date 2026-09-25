# Preparation planning: owner and developer guide

Verified against services/scheduling.py on 25 September 2026. This describes implemented behaviour, not proposed features. Read this document alongside the code if the application changes later.

## Short answer

The planner works backwards from delivery minus the kitchen's delivery buffer. It places individual steps into available worker/equipment time. It does not simply subtract all order minutes from delivery, and it does not require an entire second menu to fit inside one unattended step of the first.

The algorithm uses rules, not AI. The owner supplies realistic durations and handling limits; the software checks those recorded constraints. A feasible schedule is a recommendation, not a guarantee of punctual delivery or food safety.

## Set up a menu

1. Inventory: create raw materials with consistent units.
2. Menu: record recipe quantities PER PORTION, including salt and oil.
3. Set portions per batch: how many portions of this menu can be made in one run within one order.
4. Add steps in actual sequence, including setup, cooking, attention/checking and packing.
5. For each step set first-batch minutes, extra-batch minutes, equipment and whether someone must stay.
6. Set permitted waiting and early preparation only where your real process permits them.
7. Settings: set working hours and delivery/contingency buffer. Planner kitchen blocks record unavailable time.
8. Review the saved task breakdown when an order is accepted.

### Field meanings

- Advance notice (hours): minimum delay before preparation can start, measured from booking (or the supplied notice reference when reviewing). It is NOT merely a minimum order-to-delivery interval. A 24-hour notice plus 2 hours of work and a 30-minute delivery buffer needs more than 24 hours before delivery.
- Portions per batch: capacity of one production run for THIS menu in THIS order. Separate orders are not combined into shared batches.
- First batch duration: continuous duration of a step for one batch.
- Minutes for each extra batch: additional duration for that step for each further batch, including a partial final batch.
- Hands-on: reserves the single worker throughout the step.
- Unattended: does not reserve the worker, but still reserves the chosen equipment.
- Equipment: one unit each of prep table, stove, oven, rice cooker, fridge space and packing area. No equipment means no equipment reservation; it does not remove worker demand.
- Allowed wait before the next step: maximum gap AFTER this step. Zero requires the next step to start immediately.
- Overnight: only unattended fridge/no-equipment steps may extend outside business hours. This is not permission for unattended overnight oven cooking.
- Maximum early finish: how far the final step may finish before the dispatch-ready deadline.
- Maximum preparation span: earliest permitted first step, measured backwards from dispatch-ready time.
- Daily capacity: maximum portions of that menu delivered on the selected date across non-cancelled orders. This is an additional limit, not a replacement for task scheduling.

There are currently no editable worker counts or equipment quantities. Each step selects one equipment resource. Represent occasional attention as separate hands-on and unattended steps. The model cannot reserve multiple equipment types simultaneously for one step.

## Batch calculation, with numbers

Batches = round UP (ordered portions / portions per batch).
Step duration = first-batch minutes + (batches - 1) x extra-batch minutes.

Example: 25 portions with a batch size of 10 requires 3 batches.

- Prep: 20 + (3 - 1) x 10 = 40 minutes.
- Bake: 40 + (3 - 1) x 40 = 120 minutes.
- Pack: 15 + (3 - 1) x 10 = 35 minutes.
- Total step duration: 195 minutes.
- If only baking is unattended, hands-on time: 75 minutes.

The planner creates one 40-minute prep step, one 120-minute bake step and one 35-minute packing step. It does NOT model prep batch 2 while batch 1 bakes. Extra-batch minutes of zero explicitly assert that the additional quantity fits into the same step duration; do not use zero when extra oven runs are needed.

With custom steps, include packing yourself. The basic packing-per-portion field is only used by the fallback when there are no custom steps.

## How the date/time is chosen

1. Validate that delivery is in the future, within 90 days, from 09:00 to BEFORE 21:00 Malaysia time.
2. Check each menu's daily portion limit.
3. Calculate batches and step durations.
4. Set dispatch-ready time = requested delivery - delivery buffer.
5. Load unavailable kitchen blocks and existing pending/processing, unconsumed order reservations.
6. Try longer menu sequences first; product ID breaks ties.
7. For each menu, place the last step first, then work backwards through preceding steps.
8. Keep each step continuous and within business hours, except explicitly permitted overnight rests.
9. Move a conflicting step earlier only within its permitted wait/early-finish and preparation-span limits.
10. If any step cannot fit, reject that proposed booking with an explanation. Existing accepted orders are not automatically moved or cancelled.

The earliest scheduled task is the displayed preparation start. The latest scheduled task is preparation end. A start such as 14:43 is possible because durations and buffer are subtracted to the minute; there is no rounding to quarter-hour appointments.

Example with no conflicts: delivery 18:00, buffer 30 minutes, contiguous steps of 20, 45 and 15 minutes. Ready time is 17:30, total work is 80 minutes and start is 16:10, assuming business hours, notice and other limits allow it.

## What can overlap?

Two time intervals conflict if they overlap AND:
- either is a full kitchen block/legacy reservation; OR
- they use the same named equipment (except no-equipment); OR
- both require the worker.

A step ending at 15:00 does not conflict with one starting at 15:00. Include cleaning, movement or changeover as explicit time when necessary.

Example permitted by these resource rules:
- A: unattended oven 14:00-15:00, then hands-on packing 15:00-15:15.
- B: hands-on prep 14:00-14:15, unattended rice cooker 14:15-15:15, then hands-on packing 15:15-15:30.

B does not finish inside A's oven step. Its own steps remain consecutive, equipment does not conflict, and the hands-on intervals are distinct. The actual backwards planner may choose different times or reject a booking because of other limits; this example illustrates resource compatibility, not a guaranteed solver output.

Different menu items within the same order can overlap under exactly these rules. They do not have to wait for every batch of the previous menu to finish. Separate orders can also overlap when their saved reservations allow it.

Unattended time is used automatically, not merely displayed as advice. It does not automatically permit pausing another menu halfway through a step. A step is never split; a gap between steps requires explicit allowed-wait minutes.

## Three different totals

- Step total: sum of every step's duration, including unattended time.
- Hands-on total: sum of steps needing the worker.
- Elapsed window: latest end minus earliest start.

Two menus can have overlapping unattended time, so adding their step totals need not equal elapsed time. Allowed gaps can increase elapsed time. Neither step total nor hands-on total alone is sufficient to prove that a schedule fits.

## Limits and manual review

This is a conservative greedy scheduler, not an optimal production solver. It does not backtrack over all possible arrangements. A human may find a feasible arrangement after the planner reports no slot.

It does not:
- merge batches across orders, pipeline individual batches, or count multiple workers/ovens;
- automatically hire workers, reschedule accepted orders or cancel them;
- infer safe holding times, realistic durations or actual progress;
- calculate traffic, courier availability or live delivery ETAs.

Do not loosen food-handling limits just to make the planner accept an order. Offer another delivery time, block unavailable time, or review the real production process.

Existing orders keep a saved preparation-plan snapshot. Editing menu steps does not silently rewrite accepted schedules. The review workflow previews eligible pending orders, then applies a confirmed plan after rechecking availability. The confirmation expires after 10 minutes; changed availability requires another preview.

Legacy orders without saved steps conservatively occupy their full preparation interval. An owner must finish task setup before requesting a detailed review.

## Ingredients and preparation are related but separate

Preordering does not reserve or consume ingredients. The shopping plan allocates stock in preparation order and excludes batches expiring before the relevant preparation date. Buy shortages before cooking.

Changing an order to Cooked consumes recipe ingredients once using earliest-expiry-first (FEFO); insufficient stock rolls back the transition. Expired/held batches are excluded. Cancellation after cooking does not recreate ingredients.

Accepted orders retain timing snapshots, but recipe changes can affect subsequent ingredient consumption. Review accepted orders before changing their recipes.

## Troubleshooting

- Unexpectedly early start: check batch count, extra-batch minutes, other bookings, working hours, buffer and permitted early finish.
- No slot: check notice, working hours, continuous-step length, equipment collisions, allowed gaps and kitchen blocks.
- Only Cook/Pack shown: custom steps were absent when this order was planned. Configure steps and use eligible order review.
- Menu edits not reflected in old orders: saved plans are intentional; use review rather than assuming automatic updates.
- Very long unattended step rejected: only explicitly allowed fridge/rest tasks can span closed hours.
- Schedule looks feasible manually but is rejected: the conservative algorithm may not find your arrangement.

## Code map and chatbot handover

- backend/myapp/services/scheduling.py: validate_tasks, preparation_work, schedule_order, booked_tasks, plan_snapshot.
- frontend/src/components/PreparationTasks.jsx: step editor.
- frontend/src/components/RecipeEditor.jsx: batch, recipe and advance-preparation settings.
- frontend/src/pages/admin/PlannerPage.jsx: owner planning UI.
- backend/myapp/views: booking, planning and order-review endpoints; search for schedule_order.

Suggested prompt for a future chatbot:
"Read PREPARATION-PLANNING.md and the current scheduling.py before answering. Explain the exact current algorithm, distinguishing implemented behaviour from proposals. For my example, calculate batches, step durations, worker/equipment conflicts, notice, working hours, maximum gaps and delivery buffer. Do not assume tasks may be interrupted, workers are unlimited, orders are merged, or the greedy algorithm finds every feasible schedule. Ask me for missing settings. Never request production secrets."
