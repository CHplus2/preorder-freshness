# Customer delivery communication batches

## Batch 1: optional customer email reminders (implemented)

Customers add/update their account email in Account settings. Changing this address
also changes the password-recovery address, so the current password is required
and attempts are rate limited. Registration still accepts an optional email.

Checkout always shows the Email updates section. It displays a loading, retry or
unavailable state when appropriate; the unchecked reminder choice appears when
customer email sending is configured. My orders lets the customer change that choice on future open orders.
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

An optional GitHub scheduler workflow is prepared; automatic runs are disabled
until explicitly enabled. Existing external scheduler frequency is unknown. Do not treat configured SMTP/CRON_SECRET as proof of an active job.
Settings displays this distinction and the current eligible customer queue count.

Configure one external HTTP scheduler to request
`https://preorder-freshness.vercel.app/api/reminders/run/` with header
`Authorization: Bearer <CRON_SECRET>`. Keep the secret private, never in the URL.
Use the same secret configured on the server, at least 32 characters. Customer
mail additionally needs SMTP host/backend/from settings and a valid HTTPS
`PUBLIC_APP_URL`; owner mail additionally needs `OWNER_NOTIFICATION_EMAIL`.

Every five minutes is preferable for reminders near delivery; 15 minutes can suit
a small queue. The prepared GitHub schedule requests five-minute checks when
enabled, but scheduled GitHub jobs can be delayed or disabled by platform policy. Verify execution history and response JSON `sent`/`failed`. A zero `sent`
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

## Batch 2: handover instructions and dispatch communication (implemented)

Customers can add contact and handover instructions at checkout, or change them
in My orders before dispatch. The default is handover to a person; an unattended
location must be explicitly selected and supplied. Self-collection always uses
in-person handover. Instructions do not establish that an unattended location is
safe for storage, and do not change the agreed time, address, stock or payment.
Order updates require ownership and the current order version; completed,
cancelled and dispatched handover arrangements are handled directly with the kitchen.

The owner sees instructions in Orders, Planner, the handover board and the packing
list. Call links and customer-preferred WhatsApp drafts include the order reference
and recorded time automatically. WhatsApp opens a draft for review and manual Send;
it does not book a courier or change status. Legacy phone numbers are never treated
as automatic WhatsApp permission. Courier contact numbers are owner-only; tracking
references and public tracking links remain visible to the customer.

Customers may separately choose dispatch emails after enabling email reminders.
Existing reminder consent does not automatically subscribe them to dispatch updates.
The first actual transition to out-for-delivery queues a dispatch notice inside the
status transaction. No SMTP call is made during that update. The same cron worker
prioritises queued dispatch messages before advance reminders, within the existing
three-attempt total. For subscribed dispatched orders, a dispatch update replaces
an unsent advance reminder to avoid sending both together. Repeated status saves
do not create another notice. Receipts, retries, inactive accounts, current recipient
matching and closed-order exclusions apply. Dispatch notices expire after 24 hours;
provider acceptance does not prove arrival or inbox delivery. No real customer mail
or WhatsApp message was sent during implementation checks.

### One shared scheduler: optional GitHub setup

If another scheduler already calls the worker reliably, use that one. Otherwise,
`.github/workflows/delivery-reminders.yml` provides an explicit setup path:

1. Ensure SMTP and the sender email are configured in Vercel. Email links use an
   explicit `PUBLIC_APP_URL` or trusted Vercel production URL metadata. This release
   does not configure or retrieve private SMTP settings.
2. In GitHub -> repository Settings -> Secrets and variables -> Actions, add the
   repository **secret** `REMINDER_CRON_SECRET`, matching Vercel's `CRON_SECRET`.
   This is an application scheduler secret, not a database or email password.
   Never paste it in chat, a URL or Git. No password reset is required.
3. Open Actions -> Delivery email reminders -> Run workflow. Leave **send**
   unchecked to check local secret presence only; this does not contact the server
   or verify SMTP. Checking **send** explicitly executes the worker and may send
   real queued customer/owner emails. Inspect the safe `sent`/`failed` counts.
4. When ready, add repository **variable** `REMINDER_SCHEDULER_ENABLED` = `true`
   to enable scheduled checks on the default branch. Leaving it unset/false keeps
   automatic runs disabled. Manual runs remain available.
5. Check workflow execution history and the Settings queues. GitHub scheduling is
   best effort, not a real-time delivery guarantee. A reliable production scheduler
   or provider-backed queue is needed for stricter timing or greater volume.

The runner uses a fixed HTTPS endpoint, refuses redirects, bounds reads and time,
logs counts only, and does not retry immediately after a network/HTTP failure.
Default command `python deploy/run_delivery_reminders.py` makes no network request;
`--send` is the explicit send action. No scheduler secret or enabled variable was
configured remotely during this implementation.

## Batch 3: arrival windows and practical dispatch planning (pending)

Design agreed arrival windows separately from kitchen preparation reservations and
courier pickup/dispatch times. Carry accepted terms through checkout, scheduling,
rescheduling, customer order history and the handover board. Add agreed time-change
notifications with that scheduling contract; they are not implemented in Batch 2. Account for the single
owner's driving blocks and recipe freshness limits. Avoid merely relabelling the
current exact delivery time as a window without updating the scheduling contract.

## Batch 4: account sign-in, provider automation and final verification (pending)

Recommended account direction: email/password by default for new customers,
while preserving username access for existing accounts. This needs a deliberate
email uniqueness, verification and recovery flow. Registration remains
username/password with optional email in Batch 2. Google sign-in needs OAuth
configuration; phone sign-in needs a verification provider. An order phone number
or WhatsApp preference is contact information, not proof of account ownership.
Notification channels are explicit choices, not inferred from a registration method.

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


Email origin setup: an explicit `PUBLIC_APP_URL` takes precedence. If unset on
Vercel, the app can use trusted `VERCEL_PROJECT_PRODUCTION_URL` metadata as its
HTTPS origin. An explicitly blank value still disables the origin. Existing URL
validation rejects credentials, paths, query strings and unsafe public HTTP;
request Host/forwarded-host headers never supply notification or recovery links.
SMTP configuration and an actual scheduler are still required.
