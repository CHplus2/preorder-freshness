# Inventory review and replenishment batches — 4 November 2026

The owner requested fewer stock errors, consistent batch references, and clearer
checkout messages, in batches. The owner describes manually recorded physical
inventory in the simulated business workflow and does not want “demo” labels in
ordinary UI. Keep ordinary ingredient/storage/batch names. Do not manufacture
stock counts, food-safety evidence or historical supplier/payment facts.

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

Pending the current live audit. Calculate quantities from the active recipes and
chosen stock target, receive new batches rather than rewriting expired/used ones,
and preserve adjustment history. Storage durations/deadlines need the owner's
actual batch information or explicitly selected documented guidance; adding stock
must not silently extend earlier printed/opened/thawed limits. Physical stock
entry and a reference-format correction are different operations.

Stock gates, expiry/hold checks, transaction rollback, FEFO and one-time placement
deduction stay active. No blanket bypass, artificial order/payment history,
production receipt, model artifact or predictive dashboard change is part of this
batch. The existing reminder/report follow-ups remain separate outstanding work.
