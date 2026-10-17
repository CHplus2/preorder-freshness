# Reviewing old orders and missing delivery dates

The Planner warning counts **open pending/processing orders without valid delivery dates**. It does not mean the menus need more preparation steps or that forecast training requires task plans. Its review link now opens those same records in Orders. A separate read of the staff product catalogue identifies requests containing only archived menus; names and numeric ID ranges are not used to guess.

The cloud environment could not inspect the owner's Supabase rows: its database variable exists, but the current TCP policy has no database destinations. Consequently, the number of the owner's 11 records that contain only archived menus is **not independently verified**. The UI checks the actual API output when opened in the connected deployment.

## Order list cleanup

Completed/cancelled records containing only archived menus are hidden by default in Orders. Use **Include completed or cancelled archived-menu history** to see them, or **Review records → Archived menus only**. Open requests and mixed/unknown-menu records remain visible. If the catalogue request fails, nothing is hidden and a retry is offered.

**List item 1…N** counts the displayed results. **Order #ORD-…** remains the permanent reference. Changing database primary keys would disconnect payment, stock, amendment, calendar and saved-decision references. No records are deleted or renumbered by this change.

## Close obsolete fictional requests

`close_archived_demo_orders` previews obsolete **pending**, unscheduled requests whose every item references an archived product. Apply cancels those requests with an audit entry and a private backup. Dates, payment status/events, stock, recipes, history and order references stay unchanged. It does not assert fulfilment or a refund.

It preserves mixed/current/unknown-menu orders, started work, preparation reservations, stock consumption/deductions, refunded orders and records with payment events from sources other than `fictional_demo`. Paid records without external payment events are eligible only under the explicit fictional-data confirmation. This command must never be used on real customer records. The owner has already confirmed this project's affected records are fictional.

Run from the updated checkout in the existing connected PowerShell session, outside the Django interactive shell. Keep the configured database URL private; this command does not configure connections. Use the existing `django_app` schema.

```powershell
git pull --ff-only
$env:DATABASE_SCHEMA = "django_app"
$preview = python backend/manage.py close_archived_demo_orders | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $preview.mode -ne "preview" -or !$preview.fingerprint) { throw "Valid preview required" }
$preview.open_orders_missing_delivery | Format-Table id, status, archived_menus_only, menus
$preview.proposed_cancellations | Format-Table id, payment_status, menus
$preview.preserved_archived_requests | Format-Table id, reason
```

Review the proposed list. Only if those are obsolete fictional requests, apply the reviewed preview:

```powershell
$folder = Join-Path $HOME "FreshCast-backups"
New-Item -ItemType Directory -Force $folder | Out-Null
$backup = Join-Path $folder ("before-legacy-cleanup-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".json")
$result = python backend/manage.py close_archived_demo_orders --apply --confirm-fictional --expected-fingerprint $preview.fingerprint --actor-id 2 --backup $backup | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $result.mode -ne "applied") { throw "Cleanup was not confirmed; read the command error" }
$result.closed_order_ids
$result.remaining_open_missing_delivery | Format-Table id, archived_menus_only, menus
```

The actor must be an existing staff account; ID 2 is the owner-reported staff account. A changed dataset invalidates the preview; rerun it. Backups must be outside the checkout and must not already exist. Repeated application does not create duplicate cancellations.

Remaining missing dates need a known delivery arrangement or an explicit decision to close the request. They are not filled with invented historical dates. The existing `reschedule_freshcast_demo` command can handle an explicitly chosen future date for a paid pending fictional order with preparation steps, using the existing scheduling checks. A past completed order without a delivery date remains incomplete historical evidence, rather than receiving a fabricated sale date.

## Illustrative rescue tutorial

The two outcome counts are now separate: **11 of 20 portions sold**, followed by **9 portions remain unsold**. The 20-portion total is the same for every hypothetical action. This is a model-free teaching scenario, not a kitchen forecast or a claim of measured sales uplift.

## Validation

Frontend unit, predictive, planner, UX and checkout suites and the production build passed. Eighteen isolated Django maintenance tests passed, including the existing preparation/rescheduling commands. Chromium checks used fictional fixtures to exercise the targeted planner link, archive/mixed/open-order filters, sequential list positions, catalogue failure/retry and tutorial outcomes at 390px and 1365px. No live Supabase writes or Vercel deployment verification were performed.

## Follow-up: resolve dates in the owner UI

The earlier planner phrase **current or unverified menu references** combined two different cases. It now separates **current menus**, **archived menus only**, **mixed current/archived menus**, and **menu links need review**. Zero-count categories are omitted. A missing link is not proof an archived product still exists, and no name matching is used to invent that link.

Planner now shows a compact cooking-step readiness row, a focused missing-date issue with up to three order/menu previews, and a short FreshCast link. **Review delivery records** opens the same missing-date list.

In owner Orders, **Set delivery date** previews and confirms a specific future request. It leaves payment and fulfilment unchanged and still requires preparation review. Missing/archived menu references display a specific blocker. **Review closing request** opens the existing order dialog with cancellation selected; **Confirm close request** is the explicit save. Closing obsolete requests removes them from the open missing-date list while retaining references/history. No batch of live records was automatically modified from the cloud environment.

The tutorial header now explicitly says that its **20 chicken portions are preset fictional stock**, separate from kitchen inventory and model predictions.

## Assign the missing dates together in Planner

For the owner's confirmed fictional dataset, Planner now offers **Suggest delivery dates for demo orders** under the missing-date warning. This avoids choosing dates separately for every request.

1. Click the suggestion button. Nothing is saved yet; review each order, menu, proposed date and skipped reason.
2. Confirm **These are fictional demo requests; use the proposed future dates.**
3. Click **Set N demo delivery dates**. Planner reloads after a confirmed save.

The preset is 18:00 Malaysia time, with at most one proposed request per day, after menu notice and more than 24 hours ahead, within 90 days. The proposer respects accepted delivery-day rules (current settings only when accepted preparation settings are absent), current daily menu limits, existing dated orders, and the other proposals. These are future **demo request dates**, not reconstructed historical fulfilment. The preset is a planning convenience, not an optimized schedule.

Only pending, nonrefunded, undeducted requests with linked nonarchived menus and no existing preparation reservation or consumption qualify. Started/unsafe/unlinked/incompatible records are listed for individual review. The existing delivery validator is reused; no forecasting model, recipe, policy, payment, quantity or stock is changed.

Dates save atomically with an audit entry for every updated order. A signed preview lasts ten minutes, is bound to the staff actor and original records, and is rejected if orders, menu settings or booked capacity change. Confirmation revalidates the dates. A failed save rolls back the whole batch; an idempotent retry does not overwrite a subsequent delivery change.

As with the single-order **Set delivery date** action, saved requests still have `needs_review: true`, no preparation timestamps and no reserved tasks. Assigning dates resolves the missing-date warning but does **not** establish cooking feasibility or mark orders paid/delivered. Use **Plan upcoming orders** afterward. A missing accepted recipe may require explicit amendment to the current recipe in that existing review flow.

The owner's live records cannot be updated from the current cloud runtime because database networking remains unavailable. Applying the reviewed batch through the connected, authenticated production Planner performs the actual database changes. No terminal, new database password, or environment-variable edit is needed for that UI action.

### Run the same date repair from your connected PowerShell session

The owner prefers terminal maintenance because their local Supabase connection works. `assign_freshcast_demo_dates` invokes the same reviewed batch logic as Planner and adds a private JSON before-backup. It does not require Codex's database connection or Vercel's secret key. Keep the same local terminal/SECRET_KEY between preview and apply. No new migrations are required.

From the repository root, in the existing activated virtual environment and working database session:

```powershell
git pull --ff-only
$env:DATABASE_SCHEMA = "django_app"
$preview = python backend/manage.py assign_freshcast_demo_dates --actor-id 2 | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $preview.mode -ne "preview") { throw "Preview failed; do not apply" }
$preview.proposed_dates | Format-Table order_id, delivery_at, payment_status
$preview.skipped | Format-Table order_id, reason -Wrap
```

After reviewing the proposed dates, apply within ten minutes:

```powershell
$backup = Join-Path $HOME ("FreshCast-backups\before-delivery-dates-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".json")
$result = python backend/manage.py assign_freshcast_demo_dates --actor-id 2 --apply --confirm-fictional --confirm $preview.confirm --backup $backup | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $result.mode -ne "applied") { throw "Save was not confirmed; read the command error" }
$result | Select-Object mode, updated_order_ids, remaining_missing_dates, backup
```

The command creates the backup directory if necessary and refuses to overwrite an existing backup or write one inside the checkout. It checks the signed actor/cohort before writing, uses one transaction for the batch, and safely recognizes an already-applied token. A changed dataset, expired token or different local SECRET_KEY requires a new preview. Any skipped requests remain for individual review; a result of zero remaining missing dates resolves that warning, not preparation review or sales-history eligibility.

Verification for this batch: frontend unit, predictive, planner, UX and checkout checks plus the production build; scoped Django tests for batch/single delivery, permissions, stale previews, atomic rollback, idempotence, planning and commitments; a real local React-to-Django browser run saved 11 dates in an isolated fixture database, refreshed Planner to zero missing dates and preserved payment/status/items/stock at 320/390/1365px. These checks did not touch the owner's Supabase records.
