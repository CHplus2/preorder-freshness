# Dapur Kita

See [Vercel + Supabase deployment](DEPLOYMENT.md) and the [five-page business content brief](WEBSITE-CONTENT.md).

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
3. **Menu:** record ingredients and quantities per portion, advance notice, cooking time per order line and daily portion capacity. Current stock is calculated from the recipe, not typed into a menu stock field.
4. **Planner:** view order, preparation or delivery dates on a month calendar, check ingredient shortfalls, open delivery directions and export calendar reminders.
5. **Orders:** move Pending → Processing → Cooked → Shipped → Delivered. Cooked deducts ingredients once, earliest expiry first, inside a database transaction. Insufficient stock rolls back the whole change. Cancellation after cooking does not restore consumed food.
6. **Reports:** see 28-day net food sales, paid orders, average order value, a seven-day sales trend, all-time gross menu sales and a simple demand estimate.

## Freshness model

Every batch has its own storage type, location, quantity, receipt date, expiry source and optional hold flag.

- **Printed expiry:** enter the date from packaging.
- **Manufacture date:** add a documented shelf life to the manufacture date.
- **Unpackaged / wet-market purchase:** add a documented storage duration to receipt date.
- Calculated methods require a guidance note. They do not invent a duration from the food name or an image. Storage changes and opening packages may require shorter limits: review the batch manually.
- Expired, held and future-received batches cannot contribute to available stock or cooking deduction. Date-only expiry remains usable through the recorded date in Malaysia time.
- Customer menu details show a qualified ingredient status. This describes current stock, not the batches a future meal will use, and cannot guarantee food safety.

Reference: [FoodSafety.gov cold storage chart](https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts). Raw chicken guidance is 1–2 refrigerated days at 4°C or below. Unknown handling or broken cold storage cannot be resolved by a date calculation. Frozen quality durations are not equivalent to safety expiry dates.

## Scheduling and stock planning

Delivery is supported up to 90 days ahead, 09:00–21:00 Malaysia time. Earliest delivery = current time + the longest menu advance notice + the sum of cooking minutes for each order line + the owner’s delivery buffer. The cooking estimate covers the entire line quantity, so owners must size capacity and times conservatively.

The server checks per-menu daily capacity. It does not yet enforce shared kitchen/time-slot capacity across different menus. PostgreSQL row locks support concurrent booking and inventory operations; SQLite is for local development and can return lock contention under concurrent writes.

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
- Demand estimate = paid portions over the last 28 days / 4. It is a simple planning baseline, with no seasonality or statistical accuracy claim.
- SEO basics: meaningful title, description, Open Graph text, semantic headings, responsive layout. Production canonical URLs, sitemap, structured business data and server rendering/prerendering remain deployment work. There is no visitor/campaign attribution or marketing conversion tracking yet.

## Payments

Cash on delivery works. The existing wallet is explicitly a **demo credit ledger**, not blockchain settlement. PayPal checkout is disabled because the previous client-only flow lacked server verification. Real payment integrations require verified provider credentials, server-created amounts, webhook verification and reconciliation; no cryptocurrency or real payment service has been activated.

## Verification

```powershell
# Backend
venv/Scripts/python.exe manage.py test myapp --noinput
venv/Scripts/python.exe manage.py makemigrations --check --dry-run
# Frontend
npm run build
```

Tests cover expiry sources, missing guidance, invalid quantities, stock exclusions, FEFO, repeat cooking, atomic shortage rollback, status transitions, date lead time, capacity, discounts, private inventory, verified reviews, shopping allocation, recipe validation, reminders, recommendation cold start and unit protection.

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
