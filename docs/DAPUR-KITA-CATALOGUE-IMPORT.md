# Importing the Dapur Kita starter catalogue

`scripts/import_dapur_kita.py` translates
[the manual entry guide](DAPUR-KITA-MANUAL-ENTRY.md) and its companion
[`DAPUR-KITA-STARTER-DATA.json`](DAPUR-KITA-STARTER-DATA.json) into the existing
Django staff APIs. It runs outside Vercel using Python's standard library;
no deployment, migration or React change is required.

## What changes

- Creates/reuses **Rice meals, Noodles and Bakes**.
- Creates/reconciles **35 raw materials**, their units and illustrative estimated
  unit costs. An existing name with a different unit stops the import before
  any writes; the importer does not convert or repurpose existing materials.
- Creates/reconciles **24 menus and 280 recipe links**. It copies names, prices,
  descriptions, categories, image/social URLs, packaging costs, lead time,
  batch size, daily capacity, preparation span, early-finish limits, fallback
  durations, packing time and all detailed preparation tasks. Allergen review
  text is appended to each description.
- New menus default to **paused**. `--new-menu-status active` displays newly
  created menus in the storefront; actual stock and existing scheduling rules
  still control ordering. Review the guide's proposed prices, yields and
  timings before taking real orders. Existing target menus retain their
  selling status, delivery weekdays and AI summaries because the guide does
  not specify changes to those fields.
- `--archive-other-menus` hides the previous products while retaining their
  identities, prices, recipes, orders and accepted-order snapshots. Nothing
  is deleted or renamed to reuse an unrelated product ID. Old categories and
  materials remain, so category management may show historical categories as
  well as the three new ones.

It creates **zero inventory batches**. The 35 inventory templates contain
proposed quantities, missing dates and placeholder evidence. Enter actual
stock, suppliers, receipt/expiry dates and handling evidence separately using
the inventory interface. Catalogue replacement does **not** retrain CatBoost
or connect FreshCast forecasts to local orders: FreshCast continues to use
Genpact history and its separately labelled simulated operational CSVs.

## Access

A Vercel deployment token does not authenticate the Django staff APIs.
Provide an existing staff account through secure environment settings as
`DJANGO_STAFF_USERNAME` and `DJANGO_STAFF_PASSWORD`. The importer uses the
existing `/api/check-auth/` and `/api/login/` session/CSRF flow and checks the
staff flag. It never requests a database URL or bypasses authentication.

In Codex, save these two secret values in the environment editor and publish
the environment when required. Values must be available to HTTPS requests to
`preorder-freshness.vercel.app`. Do not paste passwords into chat, source,
command-line arguments or deployment logs. This script can run locally too
with credentials securely injected into its process environment.

## Commands

From the repository root:

```powershell
# Offline source validation, no login or network:
python scripts/import_dapur_kita.py --check

# Read-only authenticated plan:
python scripts/import_dapur_kita.py --archive-other-menus --new-menu-status active

# Apply the requested replacement and show the new menus:
python scripts/import_dapur_kita.py --archive-other-menus --new-menu-status active --apply
```

Use `--new-menu-status paused` to stage the new catalogue for review instead.
If it was already staged as paused, activate menus through existing admin
controls after review; rerunning the importer deliberately preserves existing
selling choices. Linux/Codex uses the same arguments with the configured
Python executable (currently `/workspace/venv/bin/python`).

The default target is `https://preorder-freshness.vercel.app`. To use another
environment, supply `--url https://your-demo-host`. Local testing can use
`--url http://127.0.0.1:8000 --allow-local-http`; plain HTTP is otherwise refused.

Before writing, the importer reads the complete staff catalogue and checks for
name ambiguity and unit conflicts. It saves a before-snapshot, plan and
write receipt under the operating system's temporary directory in
`dapur-kita-import/`. `--report-dir` can select a durable local directory.
Keep the receipt outside Git; it contains catalogue records, no credentials
or customer/order details.

## Failure and recovery

Each product/recipe update is transactional in Django. The whole import spans
multiple HTTP requests and **is not one transaction**. Successfully saved
records can remain if a later request fails. The importer verifies saved
fields and only starts archiving old products after all 24 target menus have
been verified. A changed old product stops its archival; there is still a
small concurrency window between the recheck and PATCH, so avoid concurrent
catalogue editing during the import.

There are no automatic retries of uncertain writes. Inspect the receipt,
run the read-only plan again, and rerun `--apply` to reconcile existing names.
An unchanged repeat makes no writes. Do not delete partial records or reset
the database. If restoring previous catalogue settings is necessary, use the
before-snapshot and existing staff edit controls; restoration is not automatic.

## Validation

`backend/myapp/test_catalogue_import.py` tests all 24 payloads against the real
Django APIs, verifies recipe/field persistence, unchanged inventory and order
snapshots, read-only planning, repeat imports, unit/name conflicts, incomplete
recipes, failed-write recovery, concurrent changes and non-staff denial.
A local HTTP server test exercises real staff login, cookie/CSRF authentication
and a complete paused import. Tests use an isolated database, not Vercel data.

## Replacing fictional past orders

The owner confirmed that all existing orders are fictional demo/test records
and requested replacement dishes and prices for those records too. This is
additional work: the catalogue importer above still preserves history.

[`DAPUR-KITA-DEMO-ORDER-MAPPING.json`](DAPUR-KITA-DEMO-ORDER-MAPPING.json) proposes
a deterministic mapping from the 20 currently visible retail products to the
first 20 guide menus. This is synthetic relabelling, not food equivalence or
observed demand. Four remaining new menus have no mapped legacy product; no
past orders are invented for them. Unmapped historical names are flagged for
an explicit mapping rather than silently dropped.

After staff access is available, inspect the actual history with:

```powershell
python scripts/plan_dapur_kita_orders.py --output "$env:TEMP\dapur-kita-order-plan.json"
```

The planner performs only GET requests. It preserves dates, quantities,
shipping fees and fixed discount amounts in the proposed calculations and
reports new unit prices, subtotals, order totals and full payment amounts.
It flags excessive discounts, existing payment events, demo-wallet orders and
previous inventory deductions. The private report excludes customer and
address fields. Keep it outside Git and treat the recast records as synthetic
demo history; they cannot establish model accuracy on real business orders.

Existing staff APIs allow status transitions, not replacement order items or
ledger edits. The explicitly guarded management command below performs that
separate operation. The read-only HTTP planner does not alter CatBoost inputs.

## Explicit one-time fictional-data rewrite

`recast_dapur_kita_demo` synchronizes the guide catalogue and recasts fictional
orders **in one database transaction**. It replaces accepted recipes and
preparation snapshots, unit prices, line subtotals, discounted food totals and
full-order payment event amounts. It preserves order/item IDs, customer
associations, order dates, delivery dates, quantities, status, shipping fees,
discount amounts and receipt/refund outcomes. The proposed mapping remains
synthetic; it is not evidence of real purchases of these dishes.

The command refuses wallet orders, structured ingredient consumption, unknown
menu mappings, conflicting material units, excessive discounts and payment
events that do not match the original full-order amount. Those cases require
separate reconciliation. Legacy inventory-deduction flags without structured
consumption are cleared; stock quantities and old inventory logs are unchanged.
Preparation times/plans are cleared for review because the new recipes have
not actually been scheduled or cooked. Ingredient cost/profit remains unknown
where consumption is unrecorded.

New guide menus are active. Old retail products are archived; obsolete retail
categories are removed after order replacement. Their original labels and
catalogue fields are preserved in the backup, and archived products' category
references become NULL. Unrelated raw materials with stock/history remain;
no inventory template is inserted as actual stock.

Before/after records are persisted in the existing **OrderAmendment** table
(`myapp_orderamendment`, in the configured Django schema) as part of the same
transaction. There is one audit record per order; the first also contains the
original catalogue and recipe records. This backup lives in Supabase, alongside
the data, rather than only in the cloud workspace. It contains no credentials
or customer addresses. Staff can inspect it through the existing accepted-recipe
API's `amendments` field. Restoring a completed rewrite requires a separately
reviewed inverse operation; it is not an automatic reset.

```powershell
# Plan on the explicitly configured database; no writes:
python backend/manage.py recast_dapur_kita_demo

# Explicitly apply only the reviewed fictional snapshot:
python backend/manage.py recast_dapur_kita_demo --apply --confirm-fictional --expected-fingerprint <reviewed-sha256>
```

The fingerprint checks the order/item identities, quantities, prices, totals,
payment/status fields and legacy consumption flags. A changed snapshot stops
the transaction. Repeating the same completed operation returns its recorded
result without rewriting data or duplicating audit records.

For the owner-authorized Vercel operation, `deploy/apply_dapur_kita_demo.py`
is an **explicit one-off operator build command**, requiring deployment-scoped
`DAPUR_KITA_CONFIRMED_FICTIONAL=1` and `DAPUR_KITA_DEMO_FINGERPRINT`. It first
finishes normal release checks, model provisioning and the frontend build,
then runs the transactional command using Vercel's existing database settings.
If the rewrite succeeds but packaging later fails, the database changes remain;
the existing live app can still serve them, and a retry uses the audit marker
to avoid duplicate changes. The usual tracked `build.py` and `vercel.json`
remain unchanged and do not run this data rewrite. There is no new public
data-rewriting endpoint. Future normal deployments need no rewrite flags.
