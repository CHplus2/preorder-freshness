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

Historical rewriting is **not implemented or applied**. Existing staff APIs
allow status transitions, not replacement order items/accepted recipes or
ledger edits. A tested, transactional database migration with backup and
reconciliation is required after inspecting this plan. A Vercel token alone
does not provide database credentials. The planner does not solve that access
requirement or alter CatBoost inputs.
