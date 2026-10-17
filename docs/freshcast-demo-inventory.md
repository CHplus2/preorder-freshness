# Fictional inventory for the kitchen workflow

`seed_freshcast_demo_inventory` is an explicit operator tool for the owner's confirmed fictional demonstration database. Deployments never run it. It does not add sales history, change models, edit recipes, alter payments or replace existing stock. Because it adds actual database rows, it changes normal demo menu availability, stock projections, FEFO and shopping lists; it is not a nonpersistent what-if API.

## What the output means

A positive menu forecast means the existing local algorithm has eligible sales history. `History needed` means no eligible history for that active menu, regardless of inventory. Adding lots enables dated stock/waste projections but cannot validate or create demand forecasts for dishes with no sales. Sparse history remains limited evidence; fictional historical orders do not establish real customer accuracy.

For each ingredient used by active recipes, the tool proposes two lots using the material's native unit:

- `DEMO-FC-INV-{material_id}-NEAR`: largest active-recipe per-portion quantity × 10, received today and assumed to expire in two days.
- `DEMO-FC-INV-{material_id}-RESERVE`: the same reference quantity × 20, received today and assumed to expire in 14 days.

These quantity/expiry choices are **scenario assumptions**, not predicted purchases, verified shelf lives or real goods received. Storage categories come from the existing guide where matched, otherwise ambient, and are unverified fictional inputs. Unit costs copy existing raw-material estimated costs; missing costs remain unknown. Recorded batch cost exposure is an estimate, not profit or realised savings. No quarantine or safety evidence is manufactured: existing quarantined/expired lots remain unchanged. The new fictional rows have no verified receipt or handling history, and prominently labeled supplier, location and guidance fields.

All active recipe materials are included; shared ingredients get one pair, not one pair per menu. Quantities do not guarantee simultaneous coverage of every menu. Invalid recipes and missing mappings are reported. Sales forecasts are computed with existing code before/after and are not forced to change: only the inventory projection should change.

## Run from the owner's connected PowerShell session

Exit the Django shell with `exit()` first. Use the existing activated virtual environment, private `DATABASE_URL`, and `DATABASE_SCHEMA=django_app`. Do not paste credentials into chat, commit them, or run migrations to resolve a schema mismatch. Local read-only access was verified by the owner in earlier batches; cloud PostgreSQL connectivity has not been established.

```powershell
git pull --ff-only origin main
$preview = python backend/manage.py seed_freshcast_demo_inventory | ConvertFrom-Json
Write-Host "Active menus:" $preview.active_menus "Recipe ingredients:" $preview.recipe_materials
Write-Host "Fictional batches to add:" $preview.proposed_batches.Count
$preview.before | Select-Object forecast_status, menus_with_forecast, menus_without_history
```

This preview writes nothing. Review the assumptions/proposed quantities if needed with `$preview.proposed_batches | Format-Table`. Do not continue after an error or missing fingerprint.

To apply this requested fictional seed, create a new private before-backup outside the checkout and use the owner's verified existing staff ID 2:

```powershell
New-Item -ItemType Directory -Force "$HOME\FreshCast-backups" | Out-Null
$backup = "$HOME\FreshCast-backups\before-demo-inventory-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$result = python backend/manage.py seed_freshcast_demo_inventory --apply --confirm-fictional --expected-fingerprint $preview.fingerprint --actor-id 2 --backup $backup | ConvertFrom-Json
$result | Select-Object mode, maintenance_id, created_batch_ids
$result.after | Select-Object forecast_status, menus_with_forecast, menus_without_history
$result.after.ingredient_projections | Format-Table
```

The command locks/snapshots scheduling/order, recipe/material and stock context, requires the reviewed fingerprint, creates an exclusive private backup and adds `InventoryLog` records with the actor and run ID. Creation and logging are atomic. If the database or local date changed, take a fresh preview. An audit failure rolls back additions. Keep the backup durably and private; deployment rollback does not undo database rows. Windows filesystem privacy depends on the backup folder ACL; POSIX mode requests alone are not a Windows ACL guarantee.

Repeated runs preserve matching demo batches even after cooking, expiry or waste; they never refill, redate or duplicate them. A deliberately new demonstration requires normal receiving/adjustment review, not automatic resetting of consumed stock. Restoring a seed must inspect its run ID, created batch IDs, subsequent inventory logs, consumption and waste; do not delete historical batch records blindly.

## Inspect the result

Refresh the stable production FreshCast page with `source=local`, not an old deployment-specific URL. The frontend shows a fictional-inventory banner; the existing inventory page shows the same label and batch codes. The seed's after-report lists actual computed menu estimates and ingredient projections. With a menu that has history, forecast consumption should reduce its associated near-expiry stock; excess may remain as estimated waste. Low confidence stays a review signal. With no menu history, the entire unallocated near-expiry amount may appear as a review scenario, never as a validated forecast alarm.

The local API adds `batches[].batch_code`; it does not change `hypothetical`, which remains reserved for nonpersistent purchase scenarios. Zero included gap and zero projected waste no longer produce an invented action deadline, and forecast-only shortages are shown separately from confirmed-order gaps. Menu forecast tickets are presented separately from known preorder requirements.
