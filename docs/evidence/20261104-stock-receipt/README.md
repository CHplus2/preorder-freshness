# Recipe-based receipt checks — 4 November 2026

The owner supplied a 35-ingredient stock audit covering 24 menus and authorized
an arbitrary planning deadline in the following year for the simulated inventory
records. The prepared receipt uses 4 November 2026 / 31 January 2027 and a target
of ten units per complete active local menu. Dates are explicitly owner-selected
planning inputs, not verified shelf-life/handling evidence. Ordinary batch codes
and the last unheld batch's storage description are used; no printed label,
opening/thawing event, supplier payment or confirmed purchase cost is invented.

Validation on ephemeral PostgreSQL 16:

- 15 selected tests passed: ten receipt tests, two deferred-audit/RLS regression
  tests and three checkout concurrency tests. Receipts cover shared-ingredient
  aggregation, correct existing-stock credit, excluded held/expired lots, stable
  historical rows, unknown costs, packaging coverage, incomplete recipe/inactive
  packaging reporting, failed-input rollback, replay protection after stock use,
  empty-review replay protection, competing runs and the 55006 failure sequence.
- The supplied 35-ingredient audit was privately reconstructed in an isolated
  database. An aggregate fixture recipe reproduces its ingredient requirements;
  it is not a replacement for any actual menu. The script added the expected
  35 new batches, with every computed quantity matching the provided stock/date
  records. Existing batches were unchanged before checkout. A real quote and
  placement succeeded for the aggregate test basket, recording 35 ingredient
  types consumed. Repeating the receipt after placement did not refill stock.
- The original audit, reconstructed database, detailed CSV quantity plan and
  private result rows are not committed. Only the boolean rehearsal summary is
  retained here. The CSV is in /workspace/outputs/inventory-replenishment/ for
  the owner to review; it is a snapshot, not the values hardcoded into the SQL.

No production database write, bank request, real supplier receipt, customer
message, model training/artifact/evaluation, frontend or frozen report branch
change was performed. The owner must run the published complete SQL in the same
Supabase database; publishing source alone does not replenish it. No migration or
new Vercel runtime is required for the existing checkout to read the new stock.
