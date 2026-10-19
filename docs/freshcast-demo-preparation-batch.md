# Finish fictional request dates and preparation plans

The owner reported nine newly dated pending requests plus two undated records:
#2 is processing/paid and #14 is processing/unpaid. Both have no preparation
start/end or stock-deduction flag. A processing status alone is not evidence
that a valid kitchen plan exists. All affected records were confirmed fictional.

`plan_freshcast_demo_orders` provides one reviewed terminal batch. It is never
run by migrations, builds, startup or deployments. The cloud workspace cannot
reach the owner's PostgreSQL instance; run it in the existing connected local
PowerShell session with the virtual environment active and
`DATABASE_SCHEMA=django_app`. Do not paste database credentials into chat.

## Preview

Update the existing checkout without discarding local changes. Both published
branches contain the same implementation. If Git cannot fast-forward, stop and
resolve the local branch difference rather than resetting it.

```powershell
git pull --ff-only origin integration/dormathon-demo
if ($LASTEXITCODE -ne 0) { throw 'Update failed; preserve local work before continuing.' }
$env:DATABASE_SCHEMA = 'django_app'
$env:PYTHON_DOTENV_DISABLED = '1'
if (!$env:SECRET_KEY) { $env:SECRET_KEY = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }
$preview = $null
$preview = .\backend\venv\Scripts\python.exe backend/manage.py plan_freshcast_demo_orders --actor-id 2 --repair-unstarted-requests --use-current-preparation | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $preview.mode -ne 'preview' -or !$preview.confirm) { throw 'A successful preview is required.' }
$preview.proposed_request_repairs | Select-Object order_id, before_status, after_status, delivery_at, payment_status | Format-Table
$preview.proposed_plans | Select-Object order_id, delivery_at, preparation_start, preparation_end, task_count | Format-Table
$preview.blocked_plans | Select-Object order_id, reason, timing_issue | Format-List
$preview.missing_delivery_dates | Format-List
```

Preview makes no persistent changes: temporary proposed reservations are rolled
back. Later proposals account for earlier proposals, existing accepted bookings,
blocked periods, equipment and worker capacity. Detailed proposed tasks and
before/after preparation settings are available in
`$preview.proposed_plans`. Review those timings before applying.

`--repair-unstarted-requests` only reopens processing records with **no delivery
date, no preparation start/end, no recorded tasks, no stock deduction, no
ingredient consumption, and no refunded status or refund event**. Eligible
records become pending requests with separate future dates chosen through the
existing menu weekdays, notice and daily-capacity rules. It does not undo cooking
or restore stock. Unlinked or archived menus remain for individual review.

`--use-current-preparation` explicitly adopts current menu preparation snapshots
for successfully scheduled orders only. It preserves accepted ingredient
recipes, packaging costs, prices and quantities, and does not edit catalogue
policies. Omit that flag to preserve accepted preparation settings too; an old
order missing its accepted steps will then remain blocked.

## Apply the reviewed result

Run within ten minutes of the preview, with the same options and staff actor.
The signed token binds the order cohort, menu settings, kitchen availability,
proposed tasks and requested repairs. Changed data requires a new preview.

```powershell
$backup = Join-Path ([Environment]::GetFolderPath('UserProfile')) ('FreshCast-backups\before-preparation-batch-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$result = .\backend\venv\Scripts\python.exe backend/manage.py plan_freshcast_demo_orders --actor-id 2 --repair-unstarted-requests --use-current-preparation --apply --confirm-fictional --confirm $preview.confirm --backup $backup | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $result.mode -ne 'applied') { throw 'Batch was not applied; read the command error.' }
$result | Select-Object mode, repaired_request_ids, planned_order_ids, backup | Format-List
$result.blocked_plans | Select-Object order_id, reason, timing_issue | Format-List
```

The command creates a new private backup outside the checkout before changes,
and an actor-attributed before/after audit for each updated order. It preserves
paid/unpaid states, payment events, inventory and order IDs. Retrying the same
confirmed batch does not duplicate work or restore subsequently edited plans.

Refresh Planner after an applied result. `repaired_request_ids` means the request
state/date was repaired; **only `planned_order_ids` means a real detailed plan
was accepted**. A date repair can succeed while its task plan remains blocked;
the order stays pending with `needs_review`, empty tasks and no reserved times.

## Why some plans can remain blocked

Zero-minute finish values now select flexible finishing on the dispatch day.
They no longer force two packing steps to end simultaneously. The obsolete
`zero_early_finish_menus` diagnostic has been removed. Existing saved task plans
remain in place; this command only proposes and applies plans explicitly reviewed
by the operator.

Plans can still be blocked by actual worker/equipment bookings, kitchen hours,
step gaps, notice, delivery capacity, or a positive early-finish cap. Review these
rules in **Menus → Recipe & preorder settings** before adopting current settings.
Changing the date alone cannot solve an oversized uninterrupted cooking step.
The maintenance command keeps strict booking checks; it does not use checkout's
unpaid-request exception path or fabricate completed sales.

Paid, delivered history feeds FreshCast independently of these pending plans.
Unpaid requests remain unpaid and do not become confirmed stock requirements
because a preparation plan exists. This maintenance does not train or alter a
forecasting model.

## Stable confirmation after the preview/apply fix

Confirmation retains the exact delivery dates reviewed in preview, then validates
them against the live notice, delivery buffer, menu-day and capacity constraints.
It does not run the date suggestion algorithm again. Order lines are explicitly
ordered by ID so recipe placement does not depend on database return order.

The signed comparison covers actual saved task plans, preparation amendments,
request states, dates and review flags. Advisory failure explanations are not
part of the decision digest: changing a note must not invalidate identical saved
decisions. Record changes and actual task-timing changes still reject the entire
batch before creating the backup or applying changes. A task mismatch names the
affected orders; crossing a notice cutoff produces a date-specific error.

After updating from the earlier command, generate a **new preview**. Old tokens
are intentionally incompatible with the corrected confirmation format. Keep the
same PowerShell window and local SECRET_KEY between preview and apply. This key
signs local maintenance previews; it does not change Vercel or database settings.

## Finish the eight remaining fictional requests

The owner confirmed a successful apply: requests #2 and #14 received dates and
pending status; #8, #15 and #17 received detailed plans. Eight requests remain:
#2, #4, #7, #9, #10, #13, #14 and #16. Their recorded zero-minute finish allowances
cannot accommodate multiple recipes sharing the worker and equipment.

The optional `--demo-finish-allowance --use-current-preparation` mode tries
early-finish allowances of 15, 30, 60, 90, 120, 180, 240, 360, 480, 720 and 1440
minutes, stopping at the first feasible candidate per order. These are **coarse
fictional scenario assumptions, not a mathematical minimum or verified food
holding limits**. The existing preparation span caps each menu's allowance.

This mode changes only the accepted preparation snapshots of successfully
planned fictional orders. It does not edit the catalogue, change preparation
spans or step waits, shorten cooking, overlap workers/equipment, move delivery
dates or plan before the current time. If changing early finish alone cannot
produce a valid plan, the request stays blocked. New customer orders continue
using the catalogue's actual settings. Supplier, holding and storage processes
must be reviewed separately for a real kitchen.

Saved plans carry `fictional_timing` metadata. Planner visibly labels the
assumptions, and subsequent owner review/manual edits preserve that label while
using the accepted preparation terms. Explicit adoption of the current catalogue
returns to those current terms and drops the old scenario label.

The short runner handles fresh tokens, error messages and private backups. In
the **same working PowerShell database session**, from the repository root:

```powershell
git pull --ff-only origin integration/dormathon-demo
if ($LASTEXITCODE -ne 0) { throw 'Git update failed.' }
.\backend\venv\Scripts\python.exe scripts/finish_freshcast_demo.py
```

The default prints the proposed timings in Malaysia time and makes no persistent
changes. After reviewing those fictional assumptions, save with:

```powershell
.\backend\venv\Scripts\python.exe scripts/finish_freshcast_demo.py --apply
```

Only the eight IDs above are in scope. The runner uses the existing database
configuration, refuses missing/non-PostgreSQL configuration or a schema other
than `django_app`, never prints credentials, and invokes the current virtual
environment's Python. It creates a temporary local signing key when necessary,
within one process, then creates a new signed preview for apply. No token needs
to be copied. Before-backups go to `FreshCast-backups` in the user's home folder.
Successful existing plans are preserved on repeat; a no-op returns a readable
message. The final applied IDs and blocker count determine what was actually
saved; a code deployment alone does not alter the database.

## Earlier preparation and saved-plan warnings

The current automatic scheduler bounds preparation by the current time and the
order's notice period. Same-day orders that cannot fit are rejected or returned
as unscheduled review requests, rather than placed before the order date.
The owner's earlier reported case could not be independently inspected because
its order ID/timestamps were unavailable; its historical cause is unconfirmed.

Planner previously checked for saved tasks before checking whether delivery was
past due. It now surfaces overdue deliveries even when tasks exist, flags saved
tasks before order creation or after delivery, and brings missed pending starts
back to preparation review. Order cards show order-placement and preparation
timestamps in Malaysia time. Recorded tasks remain visible; warnings do not
rewrite records or assume that a processing order has not started work.
