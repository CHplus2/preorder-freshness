# Sample inventory: realistic storage positions

The old seed scripts used a sample-data disclaimer as the storage location.
New samples now use fridge, freezer and pantry positions based on the scenario's
recorded storage type and ingredient. Sample provenance remains separate from
ordinary location text. Existing known batch IDs are not renamed.

## Correct existing rows

Open [the SQL correction](../deploy/sql/refresh_sample_storage_locations.sql),
copy the whole statement into Supabase SQL Editor and run it against the existing
`django_app` schema. This is a data correction, not a Django migration. It does
not require changing a password, deployment environment variable or Vercel build.

The statement returns `updated_batches` and a list of before/after locations.
A second run returns zero changes. Existing custom locations are preserved.
Only recognised `DEMO-FC-INV-<id>-NEAR/RESERVE` or date-based `FRESHCAST-DEMO` batches
with either of the two exact old placeholder locations are eligible. Other
batches are untouched, including the CHK examples whose locations are already
ordinary fridge positions. Unknown storage types are left for review.

Examples include:

| Scenario ingredient / storage | Location |
| --- | --- |
| Chicken, chilled | Fridge A - Bottom shelf - Poultry box |
| Cabbage or long bean, chilled | Fridge A - Vegetable drawer - Labelled box |
| Egg, chilled | Fridge A - Middle shelf - Egg tray |
| Rice or salt, ambient | Pantry A - Dry goods shelf - Sealed container |
| Cooking oil, ambient | Pantry A - Middle shelf - Bottles tray |
| Chicken, frozen | Freezer A - Lower basket - Poultry box |

An existing ambient chicken record gets a receiving-area storage-review label,
not an invented chilled history. New unmatched chicken samples default to chilled;
other new scenario types use the starter guide or their existing ambient fallback.
These are illustrative scenario positions, not evidence of an actual fridge,
verified food storage or a changed planning deadline.

## What remains unchanged

Quantities, costs, recorded storage types, expiry/received/opened/thawed dates,
holds and all order/forecast data are unchanged by the SQL. Expired lots remain
expired and held stock remains held. No real stock count or receiving event is
created. The global inventory sample notice and audit/provenance fields remain.

Every updated row gets a zero-quantity InventoryLog entry with the exact before
and after location in JSON. The audit reference is
`Sample storage layout correction v1`. The maintenance SQL leaves the staff
actor null rather than attributing it to an arbitrary account. Row versions are
advanced so old edit forms cannot overwrite the correction unnoticed. Row locks
fail immediately when a batch is busy; retry after editing/cooking finishes.
If audit insertion fails, the entire SQL statement rolls back, including location
changes. Before values in the log allow a reviewed correction to be reversed.

This workspace has no permitted outbound Supabase database route. The production
correction therefore requires the SQL Editor step above. Local tests use isolated
SQLite/PostgreSQL fixtures, never production records.
