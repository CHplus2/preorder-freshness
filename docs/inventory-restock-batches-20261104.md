# Inventory review and replenishment batches — 4 November 2026

The owner requested fewer stock errors, consistent batch references, and clearer
checkout messages, in batches. The owner describes manually recorded physical
inventory in the simulated business workflow and does not want “demo” labels in
ordinary UI. Keep ordinary ingredient/storage/batch names. Keep owner-authorized simulated quantities separate from claims of actual
supplier receipts, verified food-safety evidence or historical payments.

## Batch 1 — shortage presentation, references and audit

Implemented without a schema migration:

- A single ingredient check collects all relevant shortages rather than requiring
  repeated attempts to discover the next ingredient. The customer sees a compact
  ingredient list with needed/available quantities, shortfall and clear actions.
  Five rows show initially; further rows are expandable, with at most 100 returned.
  Earlier clients retain the existing error `code` and human-readable `detail`.
- The owner may leave a new batch's code blank. The server generates an ingredient
  prefix, receipt date and inventory-row ID padded to at least three digits,
  for example `CHK-20261104-081`. Supplier references remain supported. Clearing
  a code while editing explicitly standardizes it; a zero-change inventory log
  retains the former reference. The actual database ID never changes.
- `deploy/sql/standardize_short_batch_codes.sql` corrects only short CHK codes,
  including `chk-1`/`CHK-5`, in `django_app`. It leaves proper supplier and older
  sample references alone, checks conflicts, locks affected rows and records each
  correction. Running it again does not create duplicate corrections/logs.
- `deploy/sql/inventory_restock_audit.sql` is a read-only report using current
  recipes, remaining stock, batch dates and holds, plus packaging requirements.
  Defaults are ten units per active local-preorder menu and a date seven days
  ahead. These are visible planning inputs, not forecast output or a promise that
  those menus are offered on that day. It flags missing/invalid recipes separately.

The coding environment could not connect to the live database (read-only
connection returned OperationalError). No live stock was read, replenished,
renamed, unheld or redated. The SQL files make the pending live work concrete;
source publication does not itself execute them or prove a Ready deployment.

### Apply the data correction and obtain the current stock report

In the same Supabase SQL Editor/database used for `0027`, run the entire
[batch-code correction](https://github.com/CHplus2/preorder-freshness/blob/main/deploy/sql/standardize_short_batch_codes.sql).
It returns `corrected_batches`, `corrections` and `needs_review` for any conflicting
reference. No migration or RLS change is required. Past order allocations retain
their accepted batch-code snapshots; the stable batch ID and correction log link
those references to the current batch.

Then run the entire [read-only stock audit](https://github.com/CHplus2/preorder-freshness/blob/main/deploy/sql/inventory_restock_audit.sql).
Its `ingredient_report` includes each recipe-linked raw material's exact ID,
unit, required/eligible quantity, amount to receive, batch dates/holds/locations
and saved storage guidance. `packaging_report` reports the corresponding
packaging needs. Sharing these result fields allows an accurate restocking plan;
no credentials or customer contact information are needed.

### If SQL Editor reports pending trigger events (55006)

Open a **new SQL query**, clear its contents, and paste the complete latest
batch-code correction file (including `SET CONSTRAINTS ALL IMMEDIATE;`). Run all
of it together. Do not run that line separately and then run only a selection of
the WITH statement: the constraint mode is scoped to the current transaction.
The script is repeat-safe and still returns its normal correction/conflict
summary. It does not disable RLS, constraints or triggers.

The earlier correction can leave audit-log foreign-key checks deferred until
transaction end. A subsequent table/RLS alteration in the same transaction then
fails with 55006. This sequence was reproduced and the updated files tested on
PostgreSQL. The read-only stock audit itself has no audit INSERT or ALTER TABLE;
if it produces this error, check that the editor is running only that complete
read-only query rather than mixed older statements. Production query wrappers or
custom triggers have not been inspected by this environment.

## Batch 2 — receive the required ingredients and packaging

The owner provided the ingredient audit and selected a deadline in the following
year. The ready-to-run
[recipe stock receipt](https://github.com/CHplus2/preorder-freshness/blob/main/deploy/sql/receive_recipe_stock_20261104.sql)
uses receipt date **4 November 2026**, planning deadline **31 January 2027**, and
**ten selling units per complete active local menu**. These are inventory
simulation inputs, not food-safety guidance or a supplier delivery assertion.

Run the COMPLETE file in a fresh Supabase SQL Editor query, including the first
`SET CONSTRAINTS ALL IMMEDIATE;`. The final `stock_receipt_result` reports:

- `status: recorded`, new batch codes/quantities and any packaging receipts;
- `already_recorded` on a retry, with no refill of stock consumed since the first
  run (including a first review that found no shortfall);
- menus with missing/invalid recipes and inactive packaging that still need setup.

The SQL recalculates requirements against current recipes and stock at execution;
it does not hardcode the uploaded snapshot's quantities. Stock must cover the new
January deadline to count, so an existing batch that covered the earlier audit
date may no longer reduce this receipt. New records copy ordinary storage
metadata from the latest received, unheld batch. Missing/placeholder storage
causes an atomic failure for review. No storage condition is newly verified.
Unknown purchase costs remain null. New receipt logs preserve the action's
reference; expired/held batches, accepted recipes and old deductions stay fixed.
The private detailed quantity CSV prepared from the uploaded audit is retained
outside Git for owner review.

The receipt and checkout use the same kitchen lock; inventory/packaging writes
are serialized while the coverage snapshot is taken. Partial receipts roll back
on failure. The reference `Inventory receipt 20261104-B2` identifies this one
receipt. A genuinely new future receipt needs a distinct reference; reusing this
one with different dates/target units is rejected. A temporary result table is
dropped at transaction completion; no permanent schema/policy change is needed.

The coding environment rehearsed all 35 ingredient records and successful quote /
placement/deduction privately, but has not applied this receipt to production.
After running it, refresh checkout to recheck available stock. Replenishment is
finite and further orders continue deducting it normally; it is not unlimited
availability.

Stock gates, expiry/hold checks, transaction rollback, FEFO and one-time placement
deduction stay active. No blanket bypass, artificial order/payment history,
claim of an actual supplier receipt, model artifact or predictive dashboard change is part of this
batch. The existing reminder/report follow-ups remain separate outstanding work.
