# Client feedback implementation batches — 31 October 2026

Client clarification: delivery **07:30–11:00 Malaysia time**; customers need no
email or password; delivery accepts QR/cash, self-collection QR only. QR proof
is uploaded at checkout; cash does not require proof. Customer contact remains
name and phone for the order/printout. Staff access remains authenticated.

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Packaging stock page, receipts/adjustments, menu mapping, low stock, order allocations and movement history | Implemented and tested; database migration/release pending |
| 2 | Remove Planner from the client workflow and remove preparation-hour/capacity scheduling gates; commit ingredient stock at accepted placement; simplify delivery receipt status | Next |
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
