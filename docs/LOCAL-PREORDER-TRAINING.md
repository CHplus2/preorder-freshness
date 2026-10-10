# Local preorder model preparation

## Actual audit — 10 October 2026

Read the live deployment's existing staff APIs without changing business data:

| Observation | Count |
| --- | ---: |
| Orders / order items | 23 / 50 |
| Orders with no delivery date | 17 |
| Delivered and paid orders | 2 |
| Delivered and paid orders with a usable delivery date | 0 |
| Eligible completed product-week observations | 0 |

The two delivered, paid orders lack delivery dates. Six orders have dates but
are pending and unpaid. The other records are pending, processing, shipped or
cancelled. These records are owner-confirmed **fictional demo data**. Their
historical menu names/prices were subsequently reassigned to the new catalogue;
they do not demonstrate demand for those dishes. Do not turn those reassigned
identities into purported real training labels.

**No local CatBoost candidate has been trained. Local model and baseline WAPE
are unavailable (`null`), not zero.** The original Genpact model is preserved:
28.23% WAPE versus 34.81% previous-observation baseline on weeks 136–145. Those
scores do not measure Dapur Kita accuracy. The five predictive APIs continue to
use that original model and explicitly simulated operations.

## Reproduce the readiness check

Use the backend interpreter; this audit needs only the Python standard library.
Keep staff credentials in secure environment settings. From the repository root:

```bash
python scripts/audit_local_preorders.py \
  --base-url https://preorder-freshness.vercel.app \
  --provenance fictional_demo --catalogue-relabelled \
  --output-dir backend/predictive_ai/data/local/new-audit
```

The command logs in normally, then GETs `admin/orders/` and `products/`. It cannot
update orders, stock, prices, menus or model files. It creates a private minimal
`snapshot.json`, `readiness.json` and `eligible_delivery_history.csv`. The CSV
currently contains its header and zero data rows. Customer IDs, addresses,
payment details, dish names and repriced amounts are excluded. Exported order
and item IDs still require private storage. Output directories must be empty;
previous exports are preserved. `data/local/` is Git-ignored.

Replay an export after a reset without network access or staff credentials:

```bash
python scripts/audit_local_preorders.py \
  --snapshot /private/backup/snapshot.json \
  --output-dir backend/predictive_ai/data/local/replayed-audit
```

An unchanged snapshot yields identical readiness results and snapshot checksum.
**Exit code 2 means a valid, blocked readiness report** and stops a chained
training job. This command is preparation, not a trainer: verified availability
and historical recording coverage still require a subsequent data preparation
step. Preserve the minimal snapshot in private durable storage or re-export the
database; a Git push cannot preserve ignored data. Do not run the Genpact-specific
`train_model.py` on this local export or replace `demand_model.cbm` with it.

## Data needed before local training

- Track stable product IDs and their real selling history. A model learns
  quantities associated with IDs and time; dish names are not food recognition.
  Keep catalogue identity/version changes separate from historical observations.
- Record booked time, intended fulfilment time, quantities, cancellation/refund
  events and actual completion consistently. The proposed target here is paid,
  delivered portions per product per completed Monday–Sunday week in
  `Asia/Kuala_Lumpur`. Booking-date demand is a different target; it cannot fill
  missing fulfilment dates for ingredient planning.
- Verify when each menu was offered and when order recording was complete.
  No recorded orders can mean unavailable or unobserved, rather than zero demand.
  Availability history is needed before constructing a dense weekly panel.
- Aim initially for at least 12 observed completed weeks with repeated menu
  observations, keeping the latest weeks for validation. This is a practical
  preparation target, not a statistical guarantee. More history and demand
  variation will usually be necessary. Newly introduced dishes need a disclosed
  fallback rather than a claim of learned demand.
- For a future candidate, use only information available before each forecast
  week: shifted demand lags, calendar features and known menu metadata. Do not
  use future quantities, final payment/status, later price rewrites or stock
  adjustments as historical features. Reconstruct bookings as of the forecast
  cutoff; avoid double-counting them as additional forecast demand.
- Compare chronological holdout WAPE/MAE against last-week and trailing-average
  baselines. A zero-actual holdout has undefined WAPE. Save a separate versioned
  local candidate, schema, data fingerprint and metrics; reload it and validate
  before any API adoption. A demo-only candidate must remain labeled demo data.

Do not manufacture delivery dates or mark unfinished orders delivered to make
the audit pass. Recipe links help convert predicted portions into ingredient
needs; they do not fix missing or artificial demand history.

## Overordering and underordering

The existing FEFO engine already supports both:

- **Overordering:** unused stock that expires during the forecast week creates
  potential waste; review excess purchasing and possible stock use.
- **Underordering:** eligible stock below forecast ingredient need creates a
  `shortage`; recommend replenishment before the need occurs.

For example, 10 forecast portions using 0.5 kg rice each need 5 kg. With 2 kg
usable stock and 1 kg safety stock, shortfall is 3 kg and illustrative reorder
is `max(0, 5 + 1 - 2) = 4 kg`. Expired batches contribute zero usable stock.
Risk explanations now show shortfall, safety stock and replenishment explicitly.

These are calculations downstream of the demand model, not a second model.
The live Genpact demo still uses CSV recipes/batches, not local inventory. Its
weekly simulation cannot promise daily availability, verified supplier lead
times, shortage financial loss or an automatic purchase order. Existing ranking
puts known potential waste cost first; it is not a verified financial ranking
of shortages against waste. Connecting a future local model requires verified
recipes/units and actual dated, non-quarantined stock. No stock or purchases
were created by this work.
