# Explicit synthetic history for the kitchen demo

The owner confirmed the current database contains fictional/test records and requested filling missing menu history. `seed_freshcast_demo_history` adds **generated daily summaries** for active menus. It never recovers actual sales, edits existing orders, trains a new model, invokes Genpact, or runs during deployment.

## Scenario definition

The date range covers 16 completed Monday–Sunday weeks plus completed days in the current week. It ends yesterday in the application's Malaysia timezone. Each active menu gets a reproducible toy pattern of zero to four portions per permitted delivery day, capped by its current daily capacity. Some days intentionally have zero generated sales. Quantity variation is deterministic hash/weekday variation, not learned customer behavior.

An eligible existing paid/delivered menu/day is preserved and receives no generated top-up. Closed delivery weekdays and zero-capacity menus are skipped. Current names, prices, preparation snapshots and recipes are copied into clearly synthetic records; these are not actual historical product availability or recipes. Missing recipes are reported separately and do not become invented ingredient mappings.

Each new `Order` is an aggregate across that day's generated menu lines, **not an individual customer transaction**. Its paid/delivered states and historical creation/delivery dates are explicit fictional scenario inputs. Only newly generated rows receive these dates. The preparation plan contains no cooking tasks, no current reservation is made and inventory is not deducted. A dedicated disabled account with an unusable password owns the summaries; no real customer/address/phone/email is invented. Payment events are tagged `synthetic_history` and state that no funds were captured or real payment verified. Each summary has an actor/run-specific `OrderAmendment` audit record.

Because these are persistent demo database rows, existing sales totals, average order values, order counts, model comparisons and ingredient forecasts change. Order counts/AOV reflect artificial daily aggregates. Forecasts and analytics are labeled accordingly. A numerical validation or test score on this data **does not establish real-world accuracy**. The existing baseline/ridge comparison and per-menu daily algorithms run unchanged apart from additive provenance metadata; no more capable model is claimed or implied.

More generated demand may consume near-expiry demo stock and change a waste scenario into a shortage scenario. Outcomes are not hardcoded to show savings, wastage, or a particular method winning.

## Owner's connected PowerShell session

Use the existing activated virtual environment, private DATABASE_URL, and `DATABASE_SCHEMA=django_app`. Exit `>>>` with `exit()` first. The cloud workspace does not have a verified PostgreSQL connection; the owner previously applied the inventory seed locally. Never paste credentials in chat or commit database exports.

```powershell
git pull --ff-only origin main
$preview = python backend/manage.py seed_freshcast_demo_history | ConvertFrom-Json
$preview | Select-Object mode, history_start, history_end, active_menus, proposed_daily_summaries, proposed_menu_records
$preview.menu_coverage | Format-Table
```

The preview writes nothing, including no user creation. It can be repeated to obtain the same fingerprint while database/date inputs are unchanged. Inspect assumptions with `$preview.assumptions`. Do not continue after an error or missing fingerprint.

To apply the explicitly requested synthetic data using the owner's verified staff ID 2:

```powershell
if ($preview.mode -ne "preview" -or !$preview.fingerprint) { throw "Valid preview required" }
New-Item -ItemType Directory -Force "$HOME\FreshCast-backups" | Out-Null
$backup = "$HOME\FreshCast-backups\before-demo-history-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$result = python backend/manage.py seed_freshcast_demo_history --apply --confirm-fictional --expected-fingerprint $preview.fingerprint --actor-id 2 --backup $backup | ConvertFrom-Json
$result | Select-Object mode, maintenance_id
$result.after.kitchen | Select-Object menus_with_forecast, menus_without_history
$result.after.weekly | Select-Object status, history_weeks, synthetic_history_orders, selected_method, next_week_portions
```

This makes persistent changes to the connected fictional database. The command creates a new private before-backup outside the checkout with original context and the generated proposals. Retain it durably. POSIX file-mode requests alone are not a Windows ACL guarantee; keep the backup folder private. Do not blindly delete summaries when undoing a run: receipts, accepted recipe links and audit references must be reviewed with the recorded run and created IDs.

Creation of the disabled buyer, historical summary orders, menu/recipe snapshots, synthetic receipts and amendments is transactional. A receipt failure rolls back the additions. A changed snapshot/date/price/capacity requires a fresh preview. Repeat runs do not duplicate eligible history, change existing seeded portions, or replace cancelled/refunded synthetic summaries. New current days or newly active menus can propose new missing records; this is not an automatic training-data job.

## Provenance in the existing workflow

`payment_instructions.freshcast_synthetic_history.version == "1"` identifies generated summaries, along with `recipe_source: synthetic_demo`, `payment_method: synthetic_demo` and receipt `source: synthetic_history`. This is a provenance label, not authorization or proof of real sales.

- Local decision responses report synthetic item counts globally and per menu. Forecast tickets and replay disclose synthetic evidence; these menus are excluded from the frontend's evaluated-confidence count.
- Weekly forecasts report synthetic eligible-summary counts and mark recent orders. Exported training records retain the synthetic flag. Warnings distinguish generated-pattern metrics from real-world accuracy.
- Order cards label daily summaries, and sales analytics disclose their effect on totals/AOV.
- Existing inventory and preparation records remain unchanged. Generated historical orders do not appear as new upcoming preparation work.

After application, refresh the stable production kitchen assistant at `source=local`. Deploy the corresponding frontend and backend provenance changes together; an old deployment-specific URL can keep showing older UI labels. Synthetic history demonstrates the integrated algorithm and workflow, but a real forecasting evaluation still requires representative real sales, recording coverage and verified ingredient/stock inputs.
