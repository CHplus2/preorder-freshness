# Kitchen planning and assessment guide

## Owner setup

1. In Settings enter opening/closing hours and a travel/contingency buffer.
2. In Menus enter advance notice, portions per batch and daily sales capacity.
3. Either use first-batch cooking + extra-batch time + per-portion packing, or add the complete ordered preparation steps (including packing).
4. For each step enter first-batch minutes, added minutes per extra batch, equipment, and whether a worker is needed throughout.
5. Split partially attended work into setup, unattended operation and finishing. An unattended step still reserves its equipment. Zero additional-batch minutes explicitly means the step handles all portions together; validate that against equipment capacity.
6. Only unattended fridge/rest steps can cross closed hours. A five-day fridge rest is 7200 minutes. This is a scheduling example, not a safe food-storage recommendation.
7. The allowed gap after a step defaults to zero. Increase it only with a documented handling/storage process. Set a maximum preparation span and maximum early final completion for each menu.
8. Add unavailable time in Planner before accepting orders. A block reserves the whole kitchen, including unattended steps. Existing booked steps cannot be blocked over.

## Booking rules

The application reserves one worker and one unit of each named equipment type. It schedules recipe steps backwards from delivery minus the buffer; steps within a menu keep their sequence, and different menus/orders can overlap only with distinct resources and no worker conflict. All steps scale with batch count. Worker time is constrained by working hours and occupied intervals, rather than a daily sum alone. Ten free hours fragmented into small gaps may not fit one uninterrupted task.

A global kitchen database lock serializes checkout scheduling across products. Customer locks coordinate basket changes and checkout. Availability checks are advisory; placement rechecks capacity inside the transaction. Unsupported dates, daily sales limits, resource conflicts and excessive gaps return a readable error with the basket preserved. The app does not automatically cancel existing orders, move a customer's delivery, add workers or claim an optimal schedule. The greedy algorithm is conservative: an owner may find a better arrangement, but manual rescheduling is not implemented in this version. Existing orders retain their original preparation windows; older bookings conservatively reserve the whole kitchen.

## Ingredient planning

Shopping projection uses recipes per portion, current received non-quarantined stock, and earliest expiry first. A lot is allocated only once across outstanding orders. As a conservative rule it must remain within its recorded expiry through the end of planned preparation. Missing recipes cannot produce a reliable shopping list. Buying shortages is an owner task; this projection is not a physical stock reservation. Actual FEFO deduction occurs when the owner marks the order cooked and rolls back completely on shortage.

An expiry estimate is not a freshness measurement or a safety certification. Record supplier/packaging guidance, receipt date, storage conditions, and the source for a calculated shelf life. A manufacture date alone does not supply a shelf life. Do not invent a universal number of days for wet-market food or use AI to decide it is safe. Consult the supplier and documented guidance appropriate to the ingredient and handling conditions; quarantine uncertain stock.

Malaysia's Ministry of Health provides guidance specifically for home-based food businesses: https://hq.moh.gov.my/fsq/garis-panduan-keselamatan-makanan-homebased . The page covers ingredient selection, processing, packaging and distribution; its guidance is currently being updated. Review current applicable guidance with the owner.

## Delivery, recommendations and forecasting

Express delivery is an owner-confirmed request. The planner links to external GrabExpress booking; the app does not request courier quotations, charge courier fees, book a rider or sync tracking. Check Grab's supported items and service conditions: https://www.grab.com/my/express/ . Grab states it does not provide protection from heat/cold, so the owner must check suitability for the food.

Menu recommendations already use purchase categories, past purchases and recent popularity, excluding menus without available recorded ingredients. This is a free explainable recommender, not an external AI call.

The sales estimate uses completed calendar days, up to 84 days of paid, non-cancelled orders. With at least 42 observed days and 14 selling days it compares a trailing mean and linear trend on a chronological 7-day holdout, selects the lower mean absolute error, and refits for the next week. Otherwise it uses a clearly labelled rough baseline; no paid history means no estimate. It excludes costs and does not estimate profit, marketing conversion or food safety. Future error can exceed validation error. Confirmed orders should drive production before forecast demand.

## Error handling for demonstration

- Invalid IDs, dates, quantities, recipes, step definitions and unavailable slots return 400 with readable validation messages.
- Authentication/authorization restrict customer data and owner-only operations.
- Duplicate/protected records return 409 without raw database errors.
- Database outages return 503; unexpected API exceptions return 500 with a support reference and server logging, without exposing internal exception details.
- Requests time out; mutations are never automatically retried. After an ambiguous order failure customers are told to check My orders before retrying.
- Form data is retained after failures, busy controls prevent repeated clicks, review eligibility is checked before showing its form, planner has loading/retry states, and a React error boundary provides page recovery.
- Backend tests exercise conflict rules, multi-day dependencies, FEFO rollback, malformed data, permissions, review eligibility, forecast holdout, API failure redaction and constant query counts as planner orders grow. Frontend helper tests cover nested validation, HTML errors, outages, CSRF and timeouts.

## Deployment

Apply migrations 0011 and 0012 before deploying this release. They add configuration/schedule fields and preserve existing preparation timestamps; they do not reschedule bookings. Configure real menu timings before relying on automatic acceptance. Credentials remain in environment variables and are not committed.


## Daily task planner and existing orders

The planner opens on today's task agenda. It shows each saved recipe step with order, menu, time, equipment and attention requirements. Long unattended steps appear on every date they occupy. Hands-on minutes are compared with opening hours minus closed periods; overlapping closures count only once. Equipment occupancy is still checked separately during booking: a daily labour total alone cannot establish feasibility.

Menus display their preparation-step count or Needs setup. The owner supplies these steps; the app cannot infer recipes from dish names. Orders made before detailed scheduling are explicitly marked for review. After configuring menus, use Planner > Orders & review > Preview task plan. The preview preserves the agreed delivery date. Use this plan applies it after checking availability again; changed/expired previews and started orders are rejected. Until confirmed, no timestamps change. Replanning honours the original order's advance-notice time while never starting work in the past.

This remains a conservative one-worker, one-unit-per-equipment planner. It does not combine separate orders into a shared cooking batch, even when names match. Such grouping depends on quantities, equipment volume and the owner's process. The owner defines batch sizes and safe waiting limits; the app enforces those declared rules. AI is not needed for these checks and cannot establish safe holding times.
