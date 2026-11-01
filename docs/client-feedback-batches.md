# Client feedback implementation batches — 31 October 2026

Client clarification: delivery **07:30–11:00 Malaysia time**; customers need no
email or password; delivery accepts QR/cash, self-collection QR only. QR proof
is uploaded at checkout; cash does not require proof. Customer contact remains
name and phone for the order/printout. Staff access remains authenticated.

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Packaging stock page, receipts/adjustments, menu mapping, low stock, order allocations and movement history | Implemented and tested; database migration/release pending |
| 2 | Remove Planner from the client workflow and remove preparation-hour/capacity scheduling gates; deduct ingredient stock at placement; simplify delivery receipt status | Implemented and tested; database migration/release pending |
| 3 | Customer guest ordering with name/phone; QR proof upload, delivery QR/cash and pickup QR; delivery window 07:30–11:00 and area-based fees | Planned |
| 4 | Delivery-date order/item summary, individual printable order slips (name/address/phone), and sales reporting | Planned |
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
