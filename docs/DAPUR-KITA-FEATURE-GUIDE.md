# Dapur Kita: feature guide and FYP reporting notes

Reviewed against the implementation on **9 October 2026**. This is a single-vendor
Malaysian home-food preorder application. It is not a multi-seller marketplace.
Use this guide for current behaviour; older stage-by-stage documents describe the
system at earlier points in development.

## 1. How the main features meet the objectives

1. **Date-based preordering:** customers request a delivery date/time, subject to
   menu selling status, permitted delivery weekdays, advance notice and daily
   capacity. Automatic planning offers a preparation schedule; requests it cannot
   plan can still be submitted unpaid for owner confirmation.
2. **Ingredient freshness:** raw-material batches record receipt, expiry, storage
   and handling information. Date-based indicators, holds and expiry-aware stock
   consumption help the owner monitor ingredients.
3. **Single-vendor storefront:** business identity, contact information, menu,
   owner information and customer reviews belong to one kitchen. There are no
   competitor listings inside this storefront.
4. **Sales analytics:** sales, costs, expenses, waste, order contribution and
   demand estimates support decisions. Unknown costs remain unknown.
5. **Recommendations:** menu suggestions and guided discovery help customers
   narrow choices. Recorded interactions support evaluation, but do not by
   themselves establish reduced decision fatigue or increased conversion.

## 2. Customer journey and account

- Browse menus, descriptions, prices and delivery information. Save portions in
  the basket, then review the food subtotal, delivery fee and any discount.
- Account settings stores profile name and a default delivery address. Checkout
  can also update the saved address. Each accepted order keeps an address snapshot;
  changing the default address does not rewrite old orders.
- Choose a Malaysia-time delivery date and time. A browser date field may display
  month/day/year even when other text uses day/month/year. Read the full date.
- Check availability or request suggested times. Suggestions are sampled hourly
  and limited in number; an empty suggestion list does not prove no manual
  arrangement is possible. The hourly search currently checks 09:00 through 20:00;
  checkout also accepts exactly 21:00.
- Submit once and inspect My orders. If the response is lost, check My orders
  before repeating the action. Checkout references protect retries from creating
  the same order twice.
- Order stages are pending, processing, cooked, shipped and delivered. The owner
  updates actual progress. Reviews are subject to purchase/review eligibility.
- Contact links offer WhatsApp or the device's email application. SMTP does not
  control whether a customer's laptop has an email application configured.
  Copying the email/enquiry is an alternative when an email link cannot open.

## 3. Ordering rules versus preparation planning

These are different checks. Removing a preparation-fit rejection did not remove
all ordering rules.

**Rules that still reject a new request:** an empty basket; an unavailable menu;
invalid delivery weekday; past date or more than 90 days ahead; outside 09:00–21:00
Malaysia time; insufficient menu notice plus delivery buffer; or daily portion
capacity exceeded. Address ownership and supported payment method are also checked.

For example, if the current time is 15:30, menu notice is 24 hours and the delivery
buffer is 90 minutes, the earliest request is no earlier than 17:00 tomorrow.
The automatic recipe schedule may need additional time beyond that minimum.

**Preparation-fit failures:** the algorithm cannot find a schedule within the
entered task durations, worker/equipment reservations, working hours and handling
limits. At checkout this becomes a request awaiting kitchen confirmation, not a
guaranteed booking. It has no invented task times, takes no payment and uses COD.
Unexpected server/database failures are not treated as successful review requests.

## 4. How automatic preparation planning works

The scheduler is deterministic and rule-based, not AI and not a globally optimal
solver. It works backwards from delivery minus the delivery buffer. It tries a
bounded set of menu orderings and does not move existing orders to make room.

- **Advance notice:** for an automatic plan, preparation cannot start before the
  booking/reference time plus the menu's notice. Checkout's request minimum also
  includes the delivery buffer.
- **Batch size:** portions produced in one batch for that menu within that order.
  Batches = ceiling(portions / batch size). Separate customer orders are not merged.
- **Combined-batch mode:** step minutes = first-batch minutes + (batches − 1) ×
  extra-batch minutes. A partial final batch still counts as a batch.
- **Independent-batch mode:** repeat the complete recipe for each batch. This
  permits separately scheduling batches; it does not interrupt an individual step.
- **Hands-on work:** reserves the single modelled worker. Unattended work releases
  the worker but retains its equipment reservation.
- **Equipment:** one unit of each named resource. Different unattended resources
  can operate at the same time. Two hands-on steps cannot share the worker.
- **Permitted wait:** maximum gap after a step before the next step. Zero means
  the next step must follow immediately in the automatic plan.
- **Early-finish limit:** how early the final step may finish before dispatch-ready
  time. It is not an allowance to leave arbitrary food overnight.
- **Preparation span:** maximum number of days before dispatch-ready time that
  preparation may begin.
- **Overnight step:** automatic outside-hours execution is restricted to permitted
  unattended fridge/rest steps; it is not unattended overnight cooking permission.

Example: 25 portions with batch size 10 requires 3 batches. A 20-minute first step
with 10 extra minutes per additional batch takes 40 minutes in combined mode.
Hands-on minutes, summed step minutes and elapsed calendar time can differ because
unattended steps may overlap and waiting periods take calendar time.

An entire recipe can span days if separate steps and permitted gaps make that
possible. A 115-minute bake remains a continuous bake. The software does not bake
half today and half tomorrow. Real recipe design and handling requirements must
determine any split, rather than a generic time-slicing rule.

## 5. Owner confirmation and manual editing

Open **Planner → Awaiting confirmation**. Its count covers requests across dates,
not only the currently selected calendar day. Cancelled requests leave this queue.

For an unplanned request:

1. Review delivery, recipe, workload and ingredient needs.
2. Open **Set preparation times**, enter start/end and a reason.
3. Preview warnings. Review customer arrangements before confirming.
4. Confirm. The request leaves the queue and its window appears in the calendar.
5. Move the order to Processing when preparation actually begins.

**Overall window mode** reserves the whole kitchen and worker continuously,
including any overnight gap. It replaces active individual steps; the old plan
remains in history. It does not certify the recipe or calculate actual labour.

**Individual-step mode** is available when a detailed plan exists. Change start
times; end times follow saved durations. The server preserves names, durations,
equipment and worker requirements. Include every step once and keep recipe steps
in sequence. Gaps between steps do not reserve the kitchen.

Both modes require preview and explicit confirmation. Warnings cover conflicts,
closures and relevant timing/handling limits. Manual decisions can accept warned
conditions; this is owner judgment, not automatic safety approval. Dates must still
be valid, future, and end before the delivery buffer. Only pending, uncooked orders
can be edited. Do not use manual windows to hide an impossible commitment.

Signed previews expire after ten minutes and are checked against the order and
current warnings. Concurrent changes can require another preview. Repeating a
saved confirmation does not create a second amendment. History records the actor,
time, reason and old plan. Unplanned requests have no dated stock allocation until
preparation times exist. Monitor them separately when buying ingredients.

## 6. Delivery changes and accepted history

Pending orders can preview and confirm an eligible delivery change. Ordinarily,
changes close 24 hours before preparation starts. For an unplanned request awaiting
confirmation, the cutoff uses requested delivery instead. Started/refunded orders
and other restrictions may prevent online changes. The preview does not reserve
capacity; confirmation rechecks it.

Order items retain accepted recipe/preparation and packaging records. Editing a
menu does not silently rewrite those accepted records. Owner recipe amendments
are explicit and audited. Older legacy orders can lack complete accepted records
and need review. A missing historical record must not be reported as known data.

## 7. Inventory, freshness and cooking

Raw materials define units; recipes specify quantity per portion. Stock is recorded
as received batches. Keep recipe units and cost units consistent: RM12/kg equals
RM0.012/g, not RM12/g.

Expiry can come from a printed date, manufacture date plus documented shelf life,
or receipt date plus documented storage duration. Applicable opening/thawing limits
can shorten the effective deadline. Unknown or breached handling requires a hold.
Changing a storage label alone does not create evidence of a longer shelf life.

The freshness percentage is a date-based indicator, not a laboratory measurement.
It averages eligible recorded batch indicators with equal batch weight. Expired or
held batches contribute zero; insufficient records are counted separately. It is
not a guarantee about a future cooked meal.

Marking an order Cooked deducts its accepted ingredients using earliest-expiring
eligible batches first (FEFO). Empty, expired, held and future-received batches are
not usable. A shortage rejects the update atomically rather than leaving a partial
deduction. Batch consumption records support traceability and known ingredient cost.

Shopping lists are planning estimates, not purchase orders or physical reservations.
Record purchases as received stock before using them. Waste records deduct actual
batch quantity and use its known cost. Batch supplier text is not an integrated
supplier ordering system.

## 8. Payments and delivery integrations

- **COD:** no electronic payment occurs at checkout. Record actual receipts.
- **Manual bank/DuitNow:** displays configured instructions/QR. The owner verifies
  the real receipt externally; showing a QR does not establish payment success.
- **Demo wallet:** demonstration credits only. Successful debits are recorded
  transactionally; review-request fallback does not debit credits.
- **PayPal:** online checkout is not configured as a working production gateway.
- **Testnet/crypto demonstration:** separate demo functionality, not real-money
  settlement or a substitute for verified food-order payment.
- **Express delivery:** a request/arrangement for the owner, not automatic
  GrabExpress booking, courier tracking or a guaranteed traffic-aware ETA.

Cancellation does not automatically mean a refund has completed. Use Payment
records to distinguish recorded receipts, pending/failed refunds and completed ones.

## 9. Analytics and recommendations

Sales views distinguish dates, statuses and included cohorts. Read each report's
definition before interpreting a total. Food revenue and delivery fees are separate.
Estimated menu costs are different from actual accepted packaging and consumed-batch
costs. Unknown costs are not zero.

Order contribution uses the implemented realised-revenue and recorded cost rules;
it is not full net profit. Labour, overhead and fees may be outside that calculation.
Expense and waste ledgers are operational records, not double-entry accounting or
tax/e-Invoice software. Avoid counting the same purchase and consumption twice.

The forecast uses simple historical baselines. With enough history it compares a
trailing average and linear trend against the latest seven completed days; MAE is
the average absolute error on that holdout. With limited history, it reports a rough
estimate, not validated demand certainty. Confirmed orders are more useful for
immediate production than a speculative forecast.

Recommendations use implemented local rules and recorded preferences/history or
popularity; guided discovery can also consider the selected date and portions.
They do not diagnose allergies or verify dietary suitability. Interaction metrics
are descriptive. To claim reduced decision fatigue or increased conversion, run
an appropriate user evaluation/comparison rather than treating a counter as proof.

Kitchen Help supports common store questions and contact paths. Any optional
language-model integration is separate from the deterministic preparation planner.
Do not describe all recommendations or scheduling as AI simply because chat exists.

## 10. Email reminders: why several emails arrive

The scheduler calls a worker. Running every 15 minutes means **checking** every
15 minutes, not emailing every 15 minutes.

At each run the worker checks recorded preparation and requested delivery times
from **24 hours before now to 24 hours after now**, inclusive. It attempts at most
three messages, scanning orders by delivery time and preparation before delivery.
Each message identifies its order and event.

- Preparation reminders only apply while an order is pending and has a scheduled
  preparation time.
- Requested-delivery reminders apply to open orders, including requests still
  awaiting confirmation. They do not mean the owner has confirmed that delivery.
- Cancelled and delivered orders are excluded.
- Each successful order/event send is recorded. An order can therefore normally
  generate one preparation message and one delivery message.
- Changing dates does **not** clear an existing reminder record. Do not expect a
  fresh reminder for that same event after every reschedule.
- Failed sends can be retried on later runs. Provider acceptance is not proof of
  inbox arrival. There is no absolute exactly-once guarantee if a provider accepts
  mail and a later database operation fails.

Three emails at 14:10, 17:42 and 18:35 could concern different orders/events entering
the window, queued work or retries. The timestamps alone cannot establish which.
Compare the order number and preparation/delivery event in each body with cron-job
execution history. This guide does not claim to have inspected your inbox or logs.

A once-daily job can miss the useful advance warning or leave a backlog because
each run attempts at most three messages. Keep frequent checks for timely reminders;
reduce message volume by redesigning notifications as a digest if desired. A daily
digest is not currently implemented.

### Private deployment setup (maintainer reference)

Keep SMTP host/port/TLS, login/app password, DEFAULT_FROM_EMAIL,
OWNER_NOTIFICATION_EMAIL and CRON_SECRET in hosting environment variables. Use a
random CRON_SECRET of at least 32 characters. No actual secrets belong in this guide,
Git, storefront fields or screenshots. Public contact email and reminder recipient
are separate settings.

Schedule GET `/api/reminders/run/` with the HTTP header
`Authorization: Bearer <your-private-secret>`. A 15-minute interval is the existing
operating suggestion. Alternatively run `manage.py send_order_reminders --send`
from an appropriately configured scheduled worker.

HTTP 200 alone does not mean an email was sent. Inspect the JSON `sent` and `failed`
counts. Zero due reminders can produce a successful response with zero sends.
401 indicates the authorization check failed; 503 can indicate missing email setup
or a failed send. Settings checks configuration presence, not scheduler liveness.

## 11. Exception handling and security: what to demonstrate

Demonstrate validation, role/account ownership, expired/stale preview rejection,
idempotent retries, atomic stock/payment updates, and unavailable-service recovery.
Error references help diagnose unexpected failures without exposing internals.
An error boundary prevents a failed screen from being mistaken for a successful
operation; it does not repair invalid data by itself.

Try/catch in every function is not the goal. Catch expected recoverable failures at
the boundary that can handle them; preserve transaction rollback and surface genuine
failures. Never turn an unknown payment result into success or replace unknown costs
with zero just to keep a page looking complete.

## 12. Using this in Chapters 4 and 5

Chapter 4: explain the actual single-vendor architecture and the workflow per
objective. Include screenshots, important data relationships, development problems,
solutions, exception handling and permission/transaction boundaries. The planner can
be described briefly as owner-assisted scheduling rather than as a research claim
about optimal scheduling. Your supervisor can approve selective feature coverage.

Chapter 5: select representative test cases per objective, give inputs,
preconditions, expected/actual results and links to test evidence. Distinguish
automated verification from business/user validation. Discuss failures, corrections
and limits. Use synthetic data labels on screenshots.

The latest automated run and exact pass/skip results are recorded in
[LATEST-VERIFICATION-20261009.md](LATEST-VERIFICATION-20261009.md).
Logs and source hashes allow a reviewer to identify what was tested.

Automated passes do not guarantee full marks, usability, production uptime, inbox
delivery, payment-provider correctness or a new contribution to literature. A user
study, literature comparison and critical discussion must use real collected
evidence; do not invent participants, improvement percentages or completed tests.
