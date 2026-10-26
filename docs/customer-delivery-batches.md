# Customer delivery communication batches

## Batch 1: optional customer email reminders (implemented)

Customers add/update their account email in Account settings. Changing this address
also changes the password-recovery address, so the current password is required
and attempts are rate limited. Registration still accepts an optional email.

Checkout offers an unchecked reminder choice when customer SMTP settings are
configured. My orders lets the customer change that choice on future open orders.
Consent is per order and tied to the registered email; arbitrary recipients cannot
be supplied. Existing orders are not automatically subscribed. After changing the
account email, the customer must enable reminders again on existing orders.

The existing authenticated worker handles both queues:

- Owner: existing preparation/requested-delivery reminders in the 24-hour window.
- Customer: confirmed future delivery or collection within the next two hours,
  with reserved preparation times and no `needs_review` flag. Unconfirmed requests,
  closed orders, past times and inactive accounts are excluded.
- Successful customer sends have separate dated-recipient receipts. A changed
  delivery time can generate a new reminder. Opt-out/re-enable at the same time
  and address does not replay an already-sent reminder.
- At most three messages are attempted per run, prioritising up to two customer
  messages and leaving room for owner work. Idle owner capacity can be reused.
  Already-sent work is filtered in SQL; order row locks protect overlapping runs.
- SMTP failures have no success receipt and can retry on the next run. SMTP
  acceptance does not prove inbox receipt. A crash after SMTP acceptance but
  before the database commit can still produce a duplicate on a later run.
- Messages state the agreed Malaysia time and link to My orders. They do not
  claim live arrival information, change payment/stock/status or contact riders.

No new migration is required: consent uses the existing accepted fulfilment JSON;
receipts use the existing OrderReminder table. No production customer mail was
sent during implementation tests.

### Scheduler setup and verification

The repository has no active cron schedule. Existing external scheduler frequency
is unknown. Do not treat configured SMTP/CRON_SECRET as proof of an active job.
Settings displays this distinction and the current eligible customer queue count.

Configure one external HTTP scheduler to request
`https://preorder-freshness.vercel.app/api/reminders/run/` with header
`Authorization: Bearer <CRON_SECRET>`. Keep the secret private, never in the URL.
Use the same secret configured on the server, at least 32 characters. Customer
mail additionally needs SMTP host/backend/from settings and a valid HTTPS
`PUBLIC_APP_URL`; owner mail additionally needs `OWNER_NOTIFICATION_EMAIL`.

Every five minutes is preferable for reminders near delivery; 15 minutes can suit
a small queue. This is a setup recommendation, not a schedule created by this
release. Verify execution history and response JSON `sent`/`failed`. A zero `sent`
count may simply mean no eligible orders. A 503 indicates setup or send failures;
401 indicates a missing/incorrect bearer secret. Do not call production as a
"test" unless actual opted-in customer emails should be sent.

With both queues busy, two customer messages/run gives eight/hour at 15-minute
checks or 24/hour at five-minute checks. This bounded SMTP worker is not a
high-volume notification service. Monitor the displayed queue; larger businesses
need a provider-backed queue/bulk sending integration, not a larger synchronous
loop in the 60-second web function. A two-hour trigger is not a guarantee that a
backlogged or stopped scheduler delivers on time.

`manage.py send_order_reminders` previews work without sending or printing customer
addresses. `--send` executes the same shared bounded worker. Use a private terminal.

## Batch 2: handover instructions and dispatch communication (pending)

Capture customer contact/handover instructions and display them in the owner's
packing/dispatch workflow. Require an agreed location for unattended delivery;
do not infer permission from a missed phone call. Add prepared, order-specific
WhatsApp drafts that the owner reviews and sends. Distinguish carrier references,
contact details, dispatch and received confirmation. Keep tracking optional and
owner entered until a provider integration is available.

Extend opted-in notifications for dispatch/time changes using recorded workflow
events and bounded asynchronous sending. No automatic delivery completion based
on a clock. Do not claim that a tracking link produces inbound courier events.

## Batch 3: arrival windows and practical dispatch planning (pending)

Design agreed arrival windows separately from kitchen preparation reservations and
courier pickup/dispatch times. Carry accepted terms through checkout, scheduling,
rescheduling, customer order history and the handover board. Account for the single
owner's driving blocks and recipe freshness limits. Avoid merely relabelling the
current exact delivery time as a window without updating the scheduling contract.

## Batch 4: provider automation and final workflow verification (pending)

Official WhatsApp messaging needs an account/provider, consent, templates and
applicable charges. GrabExpress booking/event integration needs verified access,
regional capabilities and available testing credentials. Neither provider is
connected in this release. Verify event authenticity, retries, duplicates and
status transitions before automating carrier updates. Keep manual operation
available, with responsive and accessible customer/owner views across all batches.


### Validation notes

Focused reminder/account/checkout regression and overlapping-worker tests pass on
PostgreSQL. Two unrelated backup tests fail on PostgreSQL both before and after
this batch: the read-only export test starts its isolation change inside a Django
TestCase transaction, and the model-download test closes a streamed response's
connection before the next TestCase setup. Keep these in the existing test
maintenance backlog; do not weaken backup isolation or download access controls
as a workaround for notification work.
