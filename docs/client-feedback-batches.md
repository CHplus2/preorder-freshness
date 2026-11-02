# Client feedback implementation batches — 31 October 2026

**Branch/release update — 2 November 2026:** the owner confirmed database updates
0024–0026 are applied. Current client changes and all future development are on
`main`; `integration/dormathon-demo` is restored to the pre-client FYP website
baseline and is read-only. Earlier publication notes below describe the original
batch workflow. Vercel deployment success is a separate check. See
[main-only workflow](main-only-workflow.md).


Client clarification: delivery **07:30–11:00 Malaysia time**; customers need no
email or password; delivery accepts QR/cash, self-collection QR only. QR proof
is uploaded at checkout; cash does not require proof. Customer contact remains
name and phone for the order/printout. Staff access remains authenticated.

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Packaging stock page, receipts/adjustments, menu mapping, low stock, order allocations and movement history | Implemented and tested; database update confirmed; main source release, live build unverified |
| 2 | Remove Planner from the client workflow and remove preparation-hour/capacity scheduling gates; deduct ingredient stock at placement; simplify delivery receipt status | Implemented and tested; database update confirmed; main source release, live build unverified |
| 3 | Customer guest ordering with name/phone; QR proof upload, delivery QR/cash and pickup QR; delivery window 07:30–11:00 and area-based fees | Implemented and tested; database update confirmed; main source release, live build unverified |
| 4 | Delivery-date order/item summary, individual printable order slips (name/address/phone), and sales reporting | Implemented and tested on main; no new database migration; live deployment unverified |
| 5 | End-to-end review of client workflow, mobile UI, access control, uploads, totals and stock; map accepted changes to the FYP revision | Planned |

## Batch 1: packaging stock

Open **Kitchen workspace → Packaging** (`/admin/packaging`). Add packaging with
opening stock, a reorder threshold and an optional recorded cost per piece.
Use **Receive / adjust** for later stock movements and provide a reason.
Use **Menu packaging** to map containers/lids/bags/etc. to one selling unit of
each menu. Counts apply to a meal, box or pack as sold, not to its diners.

A new automatically confirmed order snapshots its packaging and costs, then
atomically deducts the required pieces at checkout. A shortage rolls back the
order, packaging ledger and any wallet debit, and preserves the basket. Quotes
also report shortages. A repeat checkout reference returns the saved order
without another deduction. Menu edits do not rewrite accepted order packaging.
Pending requests awaiting preparation review retain snapshots without reserving
packaging; beginning preparation allocates those snapshots. Old orders without
snapshots are not assigned invented historical packaging requirements.

Cancellation of a recorded pending/processing order returns its allocations
once. Cancellation after food is marked ready does not automatically return
packaging; an actual unused-stock correction can be recorded with a reason.

Known tracked packaging costs are copied into the accepted order's packaging
cost, at six-decimal precision before totals are rounded. Unknown costs remain
unknown. Menus without a physical packaging mapping retain their configured
packaging-cost estimate. The page and its APIs are staff-only; stock edits are
version checked, movements use retry references, and quantities cannot go below
zero. New PostgreSQL tables have RLS enabled for direct database API access;
Django's trusted table owner continues to use the staff-protected application API.

**Ingredient stock still follows the existing food-ready deduction rule in this
batch. Moving it to order placement is Batch 2**, together with removing Planner
and its rules. Customer login, payment options, receipt status, delivery fees and
reports have not yet been changed by Batch 1. The client request is not complete.

## Database and release

Migration: `backend/myapp/migrations/0024_packaging_stock.py`.
It adds four packaging tables and increases accepted packaging-cost precision;
existing ingredient stock and historical order allocations are unchanged.

After backing up the target database, apply the migration with Django from a
checkout containing this batch, using that database's existing configuration:

```powershell
.\backend\venv\Scripts\python.exe backend/manage.py migrate
if ($LASTEXITCODE -ne 0) { throw "Migration failed. Stop before deploying." }
.\backend\venv\Scripts\python.exe backend/manage.py migrate --check
```

Alternative for the existing `django_app` Supabase schema: copy and run the
**complete** `deploy/sql/0024_packaging_stock.sql` in SQL Editor. It checks the
0023 prerequisite and records 0024 only after all schema changes succeed.
Running it again verifies the recorded migration. No seed/fictional packaging
stock is inserted. The final result must show `0024_packaging_stock`.

The build's read-only migration check must pass before deployment. Publishing
source code alone does not migrate Supabase or make the new page live. This
batch is committed on `integration/dormathon-demo`; main/production are not
advanced by this batch.

## Verification

Evidence: `docs/evidence/20261031-client-packaging/`.

- Full SQLite regression: 852 discovered, 825 passed and 27 skipped. Skips include
  checks requiring PostgreSQL or external runtime artifacts; not reported as passes.
- Separate selected PostgreSQL run: 40 passed, no skips. Includes actual competing
  packaging allocations, retry locking, existing grouped progress and stock locks.
- `npm test`, `test:ux`, `test:checkout`, `test:planner`, lint and build passed.
- Browser walkthrough on isolated local data at 1440×950 and 390×844: opening
  stock, receipt, menu mapping, quote, checkout, repeat submission, low-stock
  display and history. No horizontal overflow or browser script errors observed.
- Manual SQL tested twice on isolated PostgreSQL 16 with the `django_app` schema;
  four private tables have RLS, old packaging costs and ingredient quantities are
  preserved, and no historical packaging is invented.

No production database writes, real payments, email sends or model training were
performed. FYP narrative/diagrams have not yet been revised for these unfinished
client changes; the final report update should follow the accepted workflow.

## Batch 2: orders without preparation scheduling — 1 November 2026

The default client workflow now uses **Orders** rather than Planner. Customers
choose a future date/time directly; cooking hours, advance-before-preparation,
equipment bookings, task lengths, daily preparation caps and waiting limits no
longer reject their basket. Offered menu dates/weekdays, preorder cutoffs,
fulfilment hours and arrival-window limits still apply. Preparation controls are
hidden in menu editing and Settings; the old Planner URL redirects to Orders.
The account navigation, courier guidance and FreshCast workflow links lead to
orders or stock records. Forecast methods and saved model artifacts are unchanged.

At placement, accepted recipes and packaging requirements are snapshotted.
Ingredient stock is deducted earliest-expiry first, within the same transaction
as order creation, packaging deduction and any wallet debit. Only already
received, unheld lots whose recorded deadline covers the delivery day can be
used. A shortage rolls back every deduction and preserves the basket. Quotes
read stock without deducting it; placement rechecks under locks. A checkout UUID
is required in this workflow, and retrying it returns the same order. Keep
inventory current: historical expired batches are not silently extended or
replaced with fictitious stock.

**Not received / Received** are the two delivery states. Owner receipt actions
work individually or for up to 20 selected orders after actual customer receipt.
They never infer delivery from the clock, take a payment, or deduct stock again.
A mistaken receipt can be corrected with a reason. Cancellation remains a
separate closed exception. Cancelling does not refund money or automatically
restock food; returning unused ingredient and packaging allocations requires an
explicit owner confirmation and reason. The ledger records exact original-batch
returns once. Existing generated sales summaries cannot be edited as receipts.

Agreed delivery-time changes use one form with a reason and a version check.
They keep accepted recipe terms and check allocated batch deadlines, without
calculating a preparation end time. Existing opted-in account email reminders
and time-change notices remain eligible without preparation timestamps; the
next batch changes customer identity and consent for the client's no-email flow.
No new preparation reminder is invented when an order has no preparation plan.

### Compatibility and limits

`Storefront.ordering_mode` defaults to `simple` and is read-only through the
website API. The internal `scheduled` value retains historical server/test
compatibility; the client UI does not expose a mode switch. Existing orders
remain marked `scheduled`, and existing allocations remain `preparation`.
Neither migration nor receipt actions retroactively deduct old orders or rewrite
historical plans, payment records or quantities. Old scheduling regression
fixtures explicitly opt into the historical mode; new tests exercise the real
simple default. FreshCast already subtracts booked portions from additional
forecast demand and excludes already-deducted stock from another allocation;
a new integration test verifies this with placement allocations.

Guest ordering, QR proof at checkout, delivery cash / pickup QR, the client's
07:30–11:00 window and area-specific fees are **Batch 3**, not part of this release.
Daily summaries, printable slips and reporting are **Batch 4**. Do not describe
the complete client request or FYP revision as finished yet.

### Database release and verification

After a private backup, apply **0024 first if still pending**, then
`backend/myapp/migrations/0025_simple_ordering.py` using `manage.py migrate`.
Alternatively run the complete `deploy/sql/0025_simple_ordering.sql` against the
existing Supabase `django_app` schema after 0024. The result must show
`0025_simple_ordering`; the read-only build migration check must then pass.
Do this before deploying the new application code. The three new non-null
columns retain database defaults so the previous release can still insert during
the migration/deployment interval. No live database changes were made here.

Evidence: `docs/evidence/20261101-simple-ordering/`.

- Full backend regression: 877 discovered, **848 passed, 29 skipped**. Skips
  require PostgreSQL or absent external runtime artifacts; they are not passes.
- Separate PostgreSQL run: **36 passed**, including competing ingredient orders,
  identical checkout retries, packaging locks and existing operation locks.
- Frontend unit/SSR tests, UX checks, checkout checks, historical Planner checks,
  lint and production build passed. The existing main-chunk size advisory remains.
- Chromium walkthrough at 1440×950 and 390×844: quote, retry, initial order load,
  grouped receipt, correction, one-form time change, explicit unused return,
  Planner redirect, customer receipt screen, hidden cooking controls, and no
  horizontal overflow or script errors. Stock reconciled to 1,700 g and 17 boxes
  from initial 2,000 g / 20 boxes after one received and one unused cancelled order.
- Manual SQL applied twice on isolated PostgreSQL 16. Historical order status and
  stock stayed unchanged, the migration recorded once, retained defaults were
  checked and inserts using the previous model schema still succeeded.
- No production database writes, real payments, live emails or model training.

## Batch 3: guest checkout, payment evidence and area fees — 2 November 2026

Customers now use a private browser ordering session, with no email, password or
registration form. Checkout requires **name and phone** for both handover methods,
plus a full address for delivery. Phone numbers are normalised and copied into
the order's contact/handover snapshot. An opaque Django user with an unusable
password backs the session internally; a name or phone number never authenticates
or searches another customer's records. Staff sign-in remains password protected.
The old customer-account directory is hidden in the simple-mode workspace; the
records and historical authentication routes remain available for compatibility.

The browser session lasts up to 30 days. My orders and proof downloads are scoped
to that session's user. The UI asks customers to keep their order number and
contact the kitchen after changing devices or clearing browser data. It does not
promise cross-device recovery using an unverified phone number. Ending a session
does not erase the owner's order records. New guest orders do not collect email
or enqueue customer email reminders. Existing historical opt-ins and owner email
reminders are retained; no scheduler configuration was changed by this batch.

### Payment rules

- **Delivery: DuitNow QR or cash.** Cash orders have no upload and remain unpaid
  until the owner records actual receipt. Cash collection must be arranged by the
  kitchen; this does not make a courier collect cash automatically.
- **Self-collection: QR only.** There is no delivery fee. QR must be configured in
  Settings; the customer pays the displayed total and uploads a receipt before
  placing the order.
- Uploading proof is **evidence awaiting owner verification**, never automatic
  payment confirmation. Staff review it through Orders → Payment records, verify
  their bank records and then record the payment. The application does not execute
  a bank transfer or automatic refund. Existing PayPal, wallet and escrow history
  remains intact, but those methods cannot settle a new simple-mode order.

Receipts accept still JPEG, PNG or WebP images up to 4 MB. The server decodes and
re-encodes them, strips the original filename/metadata, bounds image dimensions
and saved bytes, and stores the sanitized image privately in the database. PDF
uploads are not supported in this batch; a receipt screenshot is supported.
Only the uploader and staff can retrieve the image; responses are private and
not cached. Guest and proof tables have RLS for direct database API access.

Proof is bound to the **server-priced basket, delivery time, method, area and
arrival choice**, expires for checkout after 24 hours, and attaches to one order
inside its stock transaction. Changing checkout details requires matching proof;
the UI explicitly warns against paying twice. Reusing a submitted receipt image
for another order is blocked, including concurrent attempts. Invalid uploads are
rate limited even when validation fails. Abandoned uploads are capped per session
and day; retention/cleanup of unsubmitted database evidence remains an operational
maintenance task, rather than silently deleting financial material here.

### Hours and delivery fees

New simple-mode delivery and collection defaults are **07:30–11:00 Malaysia time**.
The owner can edit minute-based opening/closing times in Settings. Menu offered
dates and cutoffs, recorded stock and held/expired batch rules remain applicable;
cooking-capacity constraints do not return. Accepted orders keep saved handover
hours and the fee already recorded on the order.

**Settings → Collection & delivery → Delivery fees by area** supports short area
names and a fee for each. No real courier rates were invented. Existing areas
without a separate fee use the existing default delivery fee; the optional
free-delivery threshold still applies. Leave that threshold blank to always
charge the area's fee. Pickup is free of a delivery fee. The server computes
all amounts; changing a price or area invalidates stale proof, and the current
checkout sends its expected total to prevent unnoticed price changes on submit.
The basket, date/budget finder and shopping helper use the same area pricing.
The finder asks for an area where one is required. Updated FAQ and multilingual
help text describe the client workflow instead of preparation capacity or PayPal.

### Release checklist

1. Back up the private target database. Apply pending **0024**, **0025**, then
   **0026_guest_qr_fulfilment** using Django `migrate`, followed by `migrate --check`.
   Alternatively run the complete corresponding scripts in `deploy/sql/`, in
   order, against Supabase's existing `django_app` schema. The 0026 result must
   show `0026_guest_qr_fulfilment`.
2. Deploy this tested integration code only after the build's migration check
   succeeds. The added storefront fields retain DB defaults for inserts made by
   the previous release during the upgrade interval.
3. In Settings, add the owner's actual business QR image URL, enable QR payment,
   review pickup location/hours and set the actual area fees. A stock of received,
   unheld ingredients and packaging is required for new orders. No live QR,
   area-specific prices or stock were fabricated for the owner.

This batch is published to `integration/dormathon-demo`, not main. No production
DB writes, real payments, live email, courier booking or model training occurred.
The source recovery/model backups and FYP document are not changed by this batch.
Batch 4 remains: delivery-date order/item summary, printable individual slips
(name, address, phone), and sales reporting. Batch 5 remains final workflow and
FYP evidence review.

### Verification

Evidence: `docs/evidence/20261102-guest-checkout/`.

- Full backend regression: 897 discovered, 867 passed, 30 skipped. Skips require
  PostgreSQL or missing external runtime artifacts and are not counted as passes.
- Separate PostgreSQL run: 55 passed, no skips, including shared-stock contention,
  retry identity and concurrent attempts to use the same receipt image twice.
- Frontend unit/SSR, UX, checkout, recommendation, historical Planner and shopping
  helper checks passed, together with lint and the production build. The existing
  main-bundle size advisory remains.
- Chromium at 1440×1000 and 390×844: anonymous add-to-basket without registration,
  cash delivery at 07:30, correct area fee, QR-only pickup at 11:00, actual image
  upload, proof awaiting verification, unrelated guest denied access, owner proof
  review, minute settings and multiline area editing. No horizontal overflow or
  browser script errors observed. Inventory reconciled to 1,700 g / 17 containers
  from initial 2,000 g / 20 containers for three ordered units; both orders stayed
  unpaid and only the QR order had attached evidence.
- Manual SQL applied twice on isolated PostgreSQL 16. Old fees and accepted order
  snapshots stayed unchanged, migration 0026 recorded once, new morning defaults
  were verified and previous-release inserts succeeded. A directly granted
  untrusted DB reader could see no guest/proof rows under RLS.


## Receiving-QR follow-up and simpler migration route — 2 November 2026

Settings now supports a local receiving-QR image upload with a QR-only preview
and a Maybank-card crop preset. Only the crop is stored, encoded losslessly at
its selected resolution. The printed heading can be excluded; the bank can still
display its own recipient confirmation. The actual user-supplied bank card was
not published or committed. The alternative image-URL field remains supported.
There is no new schema migration for this follow-up.

For users who have not run client migrations, use the complete combined
`deploy/sql/apply_client_updates_0024_to_0026.sql` in Supabase SQL Editor.
Instructions: `docs/apply-client-database-updates.md`. The script was tested from
0023 through 0026, and rerun, on isolated PostgreSQL 16 with old stock/order/fee
values preserved. No production database was modified.

Verification: 39 focused backend tests discovered, 38 passed, one
PostgreSQL-only check skipped; frontend unit/SSR, UX, lint and build passed.
Chromium at desktop/mobile verified local upload, preview, saved crop pixel
identity, Settings persistence and overflow. Test images were synthetic colored
patterns, not financial payment codes. Full-bank QR decoding/recipient validation
requires the owner's bank app; the implementation does not claim to verify it.

## Batch 4: daily orders, print slips and dated sales — 2 November 2026

Open **Kitchen workspace → Sales** (`/admin/reports`). **Daily order summary**
uses the selected delivery/collection date in Malaysia time. It totals selling
units by accepted menu name and lists the day's active orders with print/manage
links. All non-cancelled operational statuses count, including unpaid cash and
unverified QR orders; therefore **order value is not collected sales**. Cancelled
orders are counted separately. Generated FreshCast sales summaries are excluded.
The 50-order pages do not truncate the day's quantities, menu counts or value.

Each Orders card also has **Print order slip**. The private staff print screen
shows the accepted customer name, address (or collection location), phone,
handover notes, items, unit prices, discounts, delivery fee and total. The browser's
**Print / Save PDF** button uses an A4 layout with application navigation hidden.
Guest identity and address snapshots take precedence; old orders can fall back
to their linked address when no snapshot exists. Missing values say not recorded.
Changing a current menu's name/price or the kitchen's current pickup location does
not rewrite the accepted order's slip. The kitchen heading uses its current name.
Cancelled slips remain clearly labelled; slips do not prove payment or receipt.

**Sales by delivery date** accepts a range of 1–366 days. Sales require a paid,
received order; pending, unpaid, cancelled and refunded orders do not contribute.
Generated history and orders with completed PayPal Sandbox/Sepolia test receipts
are excluded. Missing handover dates are counted separately, never replaced with
an invented date. Net food after discounts and delivery income are reported
separately; neither is profit or bank reconciliation. Menu sales use accepted
unit prices before order discounts. CSV export includes all matching daily totals
and menus, neutralises spreadsheet-formula names and contains no customer contacts.

Menu breakdowns are bounded to 500 entries with an explicit truncation notice;
overall totals still cover all matching orders. CSV refuses a truncated menu
breakdown rather than silently exporting partial results. New APIs are staff-only,
read-only and private/no-store. Print data does not load proof images or payment
credentials. Daily requests use a fixed number of queries rather than one query
per order. Date bounds use timestamp range comparisons in Malaysia time.

Older analytics, costs, recommendation metrics and forecasts are retained in
**Historical analytics, forecasts & costs**, loaded only when opened. Their
existing data/provenance definitions are unchanged. FreshCast models, training,
inference and the predictive dashboard were not changed. Integration and the FYP
document branch remain frozen; all source work for this batch is on `main`.

### Verification and release

Evidence: `docs/evidence/20261102-client-reports/`.

- Full isolated SQLite backend regression: **915 discovered, 885 passed,
  30 skipped** (PostgreSQL/external-runtime prerequisites, not passes), including
  14 new report tests for roles, dates, paging, totals, test exclusion, immutable
  read behaviour, query counts, private responses and formula-safe CSV.
- Frontend unit/SSR tests, report checks, lint and production build passed.
  The existing main-chunk size advisory remains.
- Chromium at 1440×1000 and 390×844 verified daily summaries, date-range sales,
  CSV, print links, escaped customer text, the print button, A4 PDF navigation
  removal, historical analytics on demand, and no page overflow or script errors.
- All data was isolated and fictional. No production database writes, real bank
  transfers, email sends or courier bookings occurred.

**No new migration or Supabase SQL is needed for Batch 4.** Existing 0024–0026
remain required and were confirmed by the owner. Publishing `main` does not prove
that Vercel has finished a successful production deployment. Batch 5 remains the
final client-workflow review and FYP feature mapping; no FYP objectives or report
documents were edited by this batch.
