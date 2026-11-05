# Batch 2 — packaging and ingredient stock

5 November 2026, `main`, following `78983cc`. No schema migration, forecasting
model change, real stock modification, bank transaction, email or courier event.
All stock/contact data in the checks are isolated fixtures. Source publication
does not establish successful Vercel deployment or production configuration.

## Changes

- Explicit Receive stock / Remove stock choices with positive piece counts,
  a balance preview, reason and focused validation for over-removal.
- Menu-assignment duplicate prevention, low/out-of-stock shortcuts, an unassigned
  active-menu view and 24-row initial rendering with Show more.
- Validated catalogue/history/mapping reads; failed refreshes disable stock
  writes. Pending forms are locked and request IDs are retained for retries.
- Both Packaging and Ingredient Inventory refresh on return to show new order
  deductions. Inventory refresh leaves an open editing form alone. Packaging
  uses the captured record version, so a concurrently changed form cannot
  overwrite current stock.
- Packaging shortages return a structured list with needed/available/short
  counts, a clear customer explanation and a same-selection stock retry.

## Verification

Full Django `myapp` suite: **978 tests, OK, 49 skipped**. Those skips include
PostgreSQL-only concurrency checks; this run used isolated SQLite and does not
claim new real-PostgreSQL lock verification. Existing transaction/lock code was
preserved. Added backend coverage verifies multiple packaging shortages in one
response, exact counts and no quote writes.

Frontend `npm test`, `test:checkout`, `test:packaging`, changed-file ESLint and
production build passed. Existing Vite main-chunk advisory remains. Pure tests
cover malformed stock/mapping/history responses and receipt/removal quantities;
availability rendering tests cover packaging-specific stock rules and counts.

Chromium with built assets and local Django APIs passed **17 journey checks**,
with no uncaught page errors:

1. Create packaging, receive five pieces, remove three damaged pieces and reject
   removal beyond the balance without any server stock change.
2. Assign one bag and one box per meal; prevent duplicate choices in the mapping.
3. Exhaust bags: checkout shows a two-piece shortage, blocks payment and retains
   the basket. Receive five bags and retry the same chosen date/time successfully.
4. Place two meals: ingredients go from 10,000 g to **9,800 g**, boxes from 20 to
   **18**, bags from five to **three**. Checkout replay returns the same order
   and leaves these quantities fixed. Marking actual receipt also leaves them
   unchanged.
5. Return to Inventory/Packaging: visible quantities refresh. Packaging history
   shows the order allocation and links to its order.
6. Drop the response after a four-bag supplier receipt commits; retry the same
   form. Balance becomes seven, with exactly one receipt movement.
7. Submit a form after another receipt changes the record: HTTP 409 preserves
   the newer nine-piece balance. Closing/refreshing shows the new balance.
8. Malformed catalogue data disables stock writes; retry restores valid data.
   Customer access to staff stock is denied. Mobile stock/update/shortage views
   have no horizontal overflow.

An initial browser assertion used the wrong inventory endpoint. It was corrected
to the staff endpoint, the isolated fixtures were reset, and the complete journey
passed. No production data was used to make it pass.

Screenshots:

- [Packaging stock](desktop-packaging-stock.png)
- [Order-linked packaging history](desktop-packaging-history.png)
- [Ingredient quantity after ordering](desktop-inventory-after-order.png)
- [Mobile stock update](mobile-update-packaging.png)
- [Mobile packaging shortage](mobile-packaging-shortage.png)
