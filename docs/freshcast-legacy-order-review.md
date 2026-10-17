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
