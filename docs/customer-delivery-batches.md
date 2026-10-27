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

## Batch 3: arrival windows and practical dispatch planning (implemented)

Delivery checkout supports a single agreed time, a 30-minute window or a one-hour
window. New browsing sessions start with one hour; existing point-time choices
and orders remain point times. Self-collection remains one agreed time with no
travel allowance. A window must start in the future, stay on one Malaysia date
and fit wholly inside delivery hours. It is an agreed handover range, not traffic
tracking or a guarantee that a courier can arrive at its start.

`delivery_at` remains the latest-arrival deadline (the end of the window). Recipes
are scheduled before that deadline minus the accepted delivery buffer. Lead time,
worker/equipment reservations, portion limits, recipe waiting/holding constraints,
preparation span and closures all still apply. A range does not invent extra
capacity or earlier preparation. Same-date ingredient/expiry forecasts continue
to use the accepted delivery date. Escrow deadlines also remain unchanged; once
an invoice exists, neither its deadline nor its accepted range can change.

The accepted duration is stored in existing fulfilment JSON. Quotes, bounded
hourly suggestions, checkout, customer history, signed time changes, owner plan
previews, handover board, contact drafts, packing lists and calendar exports carry
the same range. Owner range/time changes need customer agreement before confirming.
Legacy single-time suggestion producers explicitly preserve their point-time
selection rather than silently converting it into a range. No migration or
retroactive order changes are required.

Customer advance email eligibility begins two hours before the **start** of an
arrival window. Time-confirmation/change emails are a separate per-order opt-in;
old reminder or dispatch consent does not subscribe customers. Signed customer
changes, owner replanning and manual confirmation of an unconfirmed request queue
a notice only after saving a confirmed plan. The existing shared worker sends
current accepted terms, with receipts, row locks, recipient/account/consent
rechecks, retries and a 24-hour notice lifetime. It sends no payment information,
internal reason or courier ETA. The total SMTP budget remains three attempts/run.
No live mail is sent in booking, rescheduling or status transactions.

The handover board groups ranges by their starting hour and shows the dispatch
target from the accepted travel allowance. Calendar events span actual ranges;
legacy single-time reminders keep their existing calendar display span. Overdue
checks continue to use the latest-arrival deadline.

An owner driving an order can enter a start and minutes away, including handover
and return. The end is calculated. Saving uses existing kitchen-block conflict
checks and reserves all work/equipment; it does not book a driver or update order
status. This is an **independent** availability block: the owner must review or
remove it after route/order changes. The system does not guess travel times,
combine deliveries automatically or override food freshness limits.

### Deferred setup (user preference)

Finish the code batches before configuring live scheduler/provider settings.
The GitHub automatic schedule remains disabled; no remote SMTP settings, secrets,
provider accounts or enabled flags were changed. Setup does not require a new
chat. It can be completed here when the necessary hosting/repository access is
available; private credentials should not be pasted into chat.

## Batch 4A: email-first sign-in and recovery (implemented)

New storefront registration asks for email, optional name and password/confirmation;
customers no longer need to invent a username. The server stores a random stable
account reference in the existing username column. IDs, orders, wallets and old
usernames do not change. Old API clients may still supply a username; the public
form uses email by default. No migration or mail/provider setup is required for
password sign-in.

The default sign-in accepts an email or existing username. It only authenticates
when that identifier matches one account. Shared legacy emails, including inactive
accounts, and collisions between one username and another account's email do not
select a first result. Existing usernames remain available; the small exact-username
option supports rare email-shaped legacy usernames. Password failures, unknown
accounts and inactive accounts use the same generic response. Email and username
aliases share the account's database-backed attempt limit; changing email does not
reset that limit. CSRF/session/password-validation protections remain in force.

Email-only password recovery sends a link only for one eligible account. A shared
older email needs the optional existing username to disambiguate. Unknown, inactive,
unusable-password and ambiguous requests return the same generic response. Email
and username recovery aliases share their limit. Existing expiring, single-use
password-reset links and trusted origin restrictions remain unchanged. Without
SMTP, recovery mail still needs setup; registration/sign-in continue to work.

New email claims are trimmed/lowercased and checked case-insensitively against
both email addresses and email-shaped usernames, including inactive accounts.
Signup and password-confirmed account email changes serialize their checks with
the existing singleton kitchen row lock. Password validation/hashing takes place
before the shared lock; existing user row locks precede it, like checkout. The
PostgreSQL concurrency tests exercise simultaneous claims. Historical duplicates
are not modified; saving the same legacy email leaves it ambiguous. Direct imports,
SQL or Django-admin email changes bypass these application guards and must preserve
uniqueness. This is not a new database-wide unique constraint on `User.email`.

The account reference is tucked under Profile details; the email section explains
sign-in and existing-order reminder consent. Email changes still need the current
password, never transfer old reminder subscriptions, and never rename a legacy
username. Reset and sign-in requests are bounded in the browser. Mobile forms use
password managers, accessible password controls and one error surface.

Email/password authentication proves knowledge of the account password. This
release does not add a persistent verified-email identity or claim a registration
address is verified. A reset link proves access to that mailbox for its particular
reset. Mandatory signup/email-change verification and identity-provider linking
need a deliberate identity schema and SMTP rollout; they are not silently enabled
on historical accounts or presented as complete here.

## Remaining setup and optional provider work (deferred)

At the user's request, finish code batches before live configuration. The shared
GitHub reminder schedule remains disabled. Google sign-in needs OAuth credentials
and account-linking/verification rules; phone sign-in needs a verification provider.
Neither is implied by email registration. Contact phone/WhatsApp choices are not
proof of account ownership, and notification channels remain explicit per-order
choices.

Official automatic WhatsApp messaging needs provider access, consent and approved
templates. GrabExpress booking/event integration needs verified regional access
and testing credentials. Neither provider is connected, booked or simulated as
real integration. Manual call/WhatsApp drafts, owner-entered courier tracking,
arrival windows and driving blocks remain the usable workflow. Provider callbacks
must be authenticated and handle retries, duplicates and valid status transitions
before enabling automation. No customer messages or production data were used to
verify this release.


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


Batch 3 validation: full application suite 680 tests passed (15 expected skips);
81 focused tests passed against isolated PostgreSQL, including window boundaries,
confirmed-order changes, escrow terms, opt-in isolation, retries and queue checks.
All 32 deployment tests, affected frontend suites, lint and production build pass.
Thirteen browser accessibility/overflow scans pass at 1440, 390 and 320 CSS pixels;
flows cover checkout, owner confirmation, driving blocks, customer history and
signed rescheduling, plus self-collection. A shared primary-button hover contrast
issue found in the narrow-screen planner was corrected. Tests use generated local
fixtures and mocked SMTP; no live reminders, production database writes or provider
bookings occurred. No migration is required. Known unrelated PostgreSQL backup-test
limitations above remain in the existing maintenance backlog.


Batch 4A validation: 695 application tests passed (17 expected skips), including
legacy auth/CSRF, checkout, payments, reminders and kitchen regressions. The 82-test
focused PostgreSQL run passed, including simultaneous signups and competing account
email changes. All 32 deployment tests, affected frontend/UX/checkout suites, lint
and production build pass. Thirteen accessibility/overflow browser scans pass at
1440, 390 and 320 CSS pixels, covering email registration/sign-in, shared legacy
email handling, rejected/successful email changes and recovery/reset. The browser
flow completes a local reset and signs in with the changed password. Email uses
in-memory test transport only; no real mail, production database writes or live
scheduler/provider configuration occurred. `makemigrations --check --dry-run`
reports no changes. Existing PostgreSQL backup-test limitations above are unchanged.
