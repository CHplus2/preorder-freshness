# Dapur Kita

## Documentation

- [Testing and FYP evidence](docs/TESTING.md): existing tests, safe execution, report evidence and manual UI checks.

- [Preparation planning explained](docs/PREPARATION-PLANNING.md): inputs, formulas, overlap examples, batch limits, troubleshooting and a reusable chatbot prompt.
- [Operations and feature status](docs/OPERATIONS-AND-FEATURE-STATUS.md): accounting, supplier-management status, photos, freshness and integration limits.
- [Vercel + Supabase deployment](DEPLOYMENT.md) and the [five-page business content brief](WEBSITE-CONTENT.md).

A React + Django single-vendor preorder application for a Malaysian home kitchen. The earlier grocery catalogue is preserved; owners can create or edit menus and attach ingredient recipes.

## Run locally

Backend (run from `backend`):

```powershell
venv/Scripts/python.exe manage.py migrate
venv/Scripts/python.exe manage.py runserver
```

Frontend (run from `frontend`):

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173. Use your existing staff account for owner screens. Create an owner with `manage.py createsuperuser` if needed. No demo credentials are embedded.

## Owner workflow

1. **Settings:** customise the kitchen name, tagline, story, social link, contact email, travel/contingency buffer and automatic bulk discount (0–50%).
2. **Inventory:** create raw materials such as chicken, rice, salt and oil. Choose one consistent unit per material. Create separate batches for each receipt and expiry. Units cannot change after recipes or batches use them.
3. **Menu:** record ingredients and quantities per portion, advance notice, portions per batch, ordered preparation steps and daily portion capacity. Current stock is calculated from the recipe, not typed into a menu stock field.
4. **Planner:** view order, preparation or delivery dates on a month calendar, check ingredient shortfalls, open delivery directions and export calendar reminders.
5. **Orders:** move Pending → Processing → Cooked → Shipped → Delivered. Cooked deducts ingredients once, earliest expiry first, inside a database transaction. Insufficient stock rolls back the whole change. Cancellation after cooking does not restore consumed food.
6. **Reports:** see 28-day net food sales, paid orders, average order value, a seven-day sales trend, all-time gross menu sales and a simple demand estimate.

## Freshness model

Every batch has its own storage type, location, quantity, receipt date, expiry source and optional hold flag.

- **Printed expiry:** enter the date from packaging.
- **Manufacture date:** add a documented shelf life to the manufacture date.
- **Unpackaged / wet-market purchase:** add a documented storage duration to receipt date.
- Calculated methods require a guidance note. They do not invent a duration from the food name or an image. Opening/thawing dates and documented limits can shorten the effective deadline; the earliest applicable deadline is used. Unknown handling or known breaches force a hold. Storage changes do not automatically extend shelf life.
- Expired, held and future-received batches cannot contribute to available stock or cooking deduction. Date-only expiry remains usable through the recorded date in Malaysia time.
- Customer menu details show a qualified ingredient status. This describes current stock, not the batches a future meal will use, and cannot guarantee food safety.

Reference: [FoodSafety.gov cold storage chart](https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts). Raw chicken guidance is 1–2 refrigerated days at 4°C or below. Unknown handling or broken cold storage cannot be resolved by a date calculation. Frozen quality durations are not equivalent to safety expiry dates.

## Scheduling and stock planning

Delivery is supported up to 90 days ahead, 09:00 to before 21:00 Malaysia time. The planner works backwards from delivery minus the delivery buffer, placing continuous preparation steps around one worker, equipment availability, business hours and existing bookings. Step duration scales with batches. Separate menus can overlap when resources permit; tasks are not automatically interrupted.

Advance notice is a minimum delay before preparation starts. Daily menu portion limits apply in addition to resource checks. Existing accepted orders are not automatically moved. This conservative greedy scheduler can reject arrangements that a human could improve; it is not an optimal production solver.

See [the complete preparation guide](docs/PREPARATION-PLANNING.md) before configuring menu timing. It explains why elapsed order time differs from summed step duration and what unattended steps actually permit.

Preorders do not reserve or deduct ingredients. The shopping plan allocates existing stock once in preparation order and excludes stock expiring before preparation. The owner must purchase shortages before cooking. Recipe edits affect future cooking deductions for unconsumed orders; avoid changing recipes for accepted orders without reviewing them.

Express is an owner-confirmed request and retains preparation lead time. No courier is automatically booked. Directions open a map service; this is not live GPS tracking, automatic address validation, traffic ETA calculation or route optimisation. No delivery time is guaranteed.

## Notifications

Calendar export includes preparation and delivery events with a 30-minute reminder. Import into your calendar app. Re-export after changes; it is a snapshot, not a live feed.

An optional email command previews due work without sending:

```powershell
venv/Scripts/python.exe manage.py send_order_reminders
```

To enable actual email, configure these environment variables in the backend environment, using your mail provider’s settings:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=your-smtp-host
EMAIL_PORT=587
EMAIL_HOST_USER=your-account
EMAIL_HOST_PASSWORD=your-secret
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=your-verified-sender
OWNER_NOTIFICATION_EMAIL=your-owner-address
```

Then schedule one worker every 15 minutes to run `manage.py send_order_reminders --send`. Each run attempts up to 3 emails for events within the next 24 hours or overdue by at most 24 hours, skipping recorded successes. Failed sends can be retried. Sending and recording are not a distributed atomic operation, so a crash immediately after delivery may produce a duplicate on retry. No scheduler, SMTP account or Telegram integration is configured automatically. No external messages were sent during development.

## Storefront, recommendations and marketing

- Five public pages: Home, Our Story, Menu, How It Works and Contact, with mobile navigation, occasion tabs, scroll reveals and guided customer help.
- English UI; full Malay translation is not yet implemented.
- Customer reviews require a delivered order and allow one review per menu/customer.
- Owner-configured social links and automatic bulk discounts. Discounts apply to food, not delivery fees; shipping thresholds use the pre-discount subtotal.
- Local recommendations rank prior purchases, preferred categories and popularity, exclude unavailable current recipes and provide a cold-start fallback. No paid AI API is required.
- Forecast uses historical paid portions with a baseline/trend comparison when sufficient history exists. It is an estimate, not guaranteed demand; use confirmed preorders first.
- SEO basics: meaningful title, description, Open Graph text, semantic headings, responsive layout. Production canonical URLs, sitemap, structured business data and server rendering/prerendering remain deployment work. There is no visitor/campaign attribution or marketing conversion tracking yet.

## Payments

Cash on delivery works. The existing wallet is explicitly a **demo credit ledger**, not blockchain settlement. PayPal checkout is disabled because the previous client-only flow lacked server verification. Real payment integrations require verified provider credentials, server-created amounts, webhook verification and reconciliation; no cryptocurrency or real payment service has been activated.

## Verification

```powershell
# Backend: run from backend, explicitly isolate tests from live Supabase
$env:PYTHON_DOTENV_DISABLED='1'
$env:SECRET_KEY='local-test-only'
$env:DATABASE_URL='sqlite:///:memory:'
venv/Scripts/python.exe manage.py test myapp --noinput
venv/Scripts/python.exe manage.py makemigrations --check --dry-run
# Frontend
npm run build
```

Use a separate terminal for these test-only environment variables; close it before running the normal server.\n\nTests cover expiry sources, missing guidance, invalid quantities, stock exclusions, FEFO, repeat cooking, atomic shortage rollback, status transitions, date lead time, capacity, discounts, private inventory, verified reviews, shopping allocation, recipe validation, reminders, recommendation cold start and unit protection.

Migrations 0006–0008 extend the existing ingredient work. Migration 0006 marks earlier orders as already deducted because previous checkout deducted immediately. A local pre-migration backup is kept in ignored `backend/backups/pre-dapur.sqlite3`.

## Project scope

The strongest target is sellers preparing food in batches: lunch boxes, family meals, kuih, baked goods and celebrations. Home-based food includes both meals and snacks. Whether customers want weekly lunch plans should be established through interviews; the app currently supports separate dated orders, not recurring meal subscriptions. Competitor scheduling limits and claims that no other platform offers freshness monitoring need current evidence before being used in an academic report.


### Hosted reminder trigger and manual payments
Apply migration 0013 before deploying this version (python manage.py migrate).
In Settings, enter your business bank transfer instructions and/or a DuitNow QR image URL,
then enable manual payments. Checkout snapshots these details on each order. Transfers remain
unpaid until an owner verifies their bank records and marks the order paid. This is not bank API verification.

For hosted email reminders, configure the SMTP variables above and a random CRON_SECRET
of at least 32 characters. Configure an external scheduler to GET /api/reminders/run/ with
Authorization: Bearer followed by CRON_SECRET every 15 minutes (or more often for higher volumes).
Do not include the secret in the URL. No scheduler is automatically installed.
Each invocation attempts up to 3 messages; failures return HTTP 503 so the scheduler can retry.
Only events within the next 24 hours or overdue by at most 24 hours are included.
SMTP delivery and database recording cannot be atomic: a process crash after sending can still
cause a duplicate on retry. Keep credentials in the hosting environment, never in Git.
Settings shows configuration readiness, not a guarantee that a scheduler or SMTP delivery works.


### Ingredient evidence and costing (migration 0014)
Inventory now records source, supplier, label meaning, original printed deadline, opening/thawing dates
and their documented day limits, handling evidence and batch unit purchase cost.
The effective deadline is the earliest applicable date. Uncertain handling / known breaches force a hold.
The system does not infer microbiological safety from dates, AI or a single temperature reading.
It does not model a continuous time-temperature history. Hourly/same-day rules require owner review.

Sales > Costs, wastage and pricing provides current recipe contribution estimates:
menu price minus recipe quantities times ingredient unit-cost assumptions minus per-portion packaging.
These are current estimates, not historical or net profit. Missing costs remain unknown.
The selected date range filters operating expenses and waste; it does not change current recipe costs.
Wastage reduces inventory atomically and freezes its estimated cost. Void incorrect expenses instead
of deleting the ledger. Use one inventory unit consistently; RM/kg and RM/g must not be confused.
Do not count stock purchases as overhead and again as consumed recipe cost in your own calculations.

The scheduler continues to assume one worker and one unit of each named equipment type.
Each step runs continuously. Zero allowed wait joins consecutive steps within one menu; separate
menus can overlap when equipment and worker time allow. Extra batches extend each step; the
scheduler does not yet pipeline individual batches or reserve a continuous whole-order block.
