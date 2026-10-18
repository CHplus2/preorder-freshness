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
$preview = python backend/manage.py plan_freshcast_demo_orders --actor-id 2 --repair-unstarted-requests --use-current-preparation | ConvertFrom-Json
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
$result = python backend/manage.py plan_freshcast_demo_orders --actor-id 2 --repair-unstarted-requests --use-current-preparation --apply --confirm-fictional --confirm $preview.confirm --backup $backup | ConvertFrom-Json
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

Several menu guide templates have a zero-minute maximum early finish. If two
menus both need the same worker or packing area for their final step, they
cannot both finish exactly at dispatch. A later delivery date alone cannot
resolve this. The preview identifies the affected orders and menu names.

Review the actual permitted early finish in **Menus → Advance preparation
limits**, and allowed waits in each preparation step. Do not invent handling
limits merely to clear a warning. After reviewing those terms, rerun the batch
with `--use-current-preparation`. This command does not loosen holding limits,
change kitchen hours, overlap resources, drop cooking steps, fabricate completed
sales, or accept a generic manual reservation as a detailed task plan.

Paid, delivered history feeds FreshCast independently of these pending plans.
Unpaid requests remain unpaid and do not become confirmed stock requirements
because a preparation plan exists. This maintenance does not train or alter a
forecasting model.
