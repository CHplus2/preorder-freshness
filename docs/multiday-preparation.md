# Preparation across working days

Large orders can use earlier working days without making a cooking step run
through a closed kitchen. Configure the recipe in **Menus → Edit & steps**.
Existing accepted orders retain their saved recipe settings until an owner
explicitly adopts the current recipe and replans them.

## Choose the appropriate recipe policy

- **Preparation across days:** set the permitted span (1–30 days), measured back
  from dispatch. This permits earlier work; it does not extend working hours.
- **Finished batches may be ready early:** record the actual permitted finish
  allowance in minutes. 1440 minutes is one day. The allowance cannot exceed the
  preparation span. **0 means flexible finishing on the dispatch day**, within
  kitchen working hours. It does not force menus to finish together or permit a
  previous-day final finish. Positive values explicitly limit early finish and
  may permit a previous-day finish when the preparation span also allows it.
- **Split larger orders into complete recipe batches:** each batch repeats the
  full recipe. Complete batches may occupy different days when their finish
  allowances permit it. A partial final batch still takes a full batch duration.
  Separate customer orders are not combined.
- **Allow this preparation work to pause and resume:** use only for attended
  prep-table, packing or no-equipment work whose handling process permits a pause.
  Record the maximum pause and any fridge space needed. For example, a kitchen
  closing at 20:00 and reopening at 08:00 needs at least a 720-minute pause to
  resume next morning. This is an example of timing, not a food holding standard.
- **Allowed wait before the next step:** controls the gap after a completed
  step. It is separate from a pause within resumable work.
- **Overnight rest:** an explicitly unattended fridge/rest step may continue
  outside opening hours. Cooking, oven and rice-cooker steps remain uninterrupted;
  they cannot be marked resumable. Record loading and finishing separately if
  they require attention.

The scheduler reserves each work session and its pause storage, keeps recipe
order and checks existing bookings. One worker and one unit of each named
equipment type are modelled. Full kitchen closures also block storage pauses.
The solver tries bounded alternative placements; it is conservative and does not
promise to find every feasible arrangement a person could devise.

## Checkout and planner

Availability and saved order cards show a preparation-by-day breakdown for
multi-day plans. Daily work remains within kitchen hours. Earlier work must also
respect order notice, the preparation span, task gaps, pause limits and finish
allowances; the scheduler never backdates new preparation before the order.

Daily menu capacity remains **portions delivered on that date**. It is not a
per-preparation-day quota. Duplicate basket lines are added together when
checking this limit.

If a recipe plan cannot fit, checkout can submit an unpaid owner-review request
without reserving preparation tasks or daily capacity. Short notice and quantities
above automatic daily capacity also become review requests at checkout. Suggestions
and normal planning remain strict; owner replan/maintenance checks do not inherit
these checkout exceptions. Future dates, the 90-day horizon, active menus, delivery
weekdays and the 09:00–21:00 delivery window remain enforced. The owner must confirm
a real arrangement; a submitted request does not promise acceptance.

## Additive API fields

Preparation steps in the existing product API accept:

| Field | Meaning |
| --- | --- |
| `splittable` | Boolean, default false; eligible attended work only |
| `max_pause_minutes` | Whole minutes, 0–10080; positive when resumable |
| `pause_resource` | `fridge` or `none`, default `none` |

Automatic quote and saved-plan responses add `daily_work`, `calendar_days`,
`hands_on_days`, `pause_minutes` and `recipe_minutes`. Each daily row contains
`date` (Malaysia calendar date), `hands_on_minutes`, `pause_minutes` and
`task_count`. Task rows may contain `segment_role` (`work`/`pause`),
`segment_index`, `part_number` and `part_count`. `minutes` includes explicitly
reserved pauses; `recipe_minutes` excludes those added pauses. Hands-on totals
exclude unattended pauses. Manual step edits refresh the daily breakdown.

These settings use the existing JSON fields; **no database migration is needed**.
The catalogue is not rewritten and saved task reservations are not moved. New
automatic plans and explicit replans interpret existing zero finish allowances as
flexible same-day finishing. Positive finish caps retain their existing meaning. Forecast models and inventory deduction rules are unchanged.

## Verification

`myapp.test_multiday_planning` exercises two-day work, bounded pauses, storage
conflicts, closures, continuous cooking, independent batches, delivery capacity,
and quote → placed-order snapshot retention. Existing planning, manual planning,
demo maintenance, rescheduling and commitment tests provide regression coverage.
Frontend tests cover the editor, estimates and multi-day availability summaries.
