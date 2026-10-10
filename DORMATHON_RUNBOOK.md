# Dormathon — overlay into existing Django + React FYP

This zip is **an integration starter**, not a pretrained ML model or finished website.

## Confirm the hackathon rules first
Reuse of pre-existing code may be restricted or must be declared. Confirm with organizers and document original vs new features.

## Overlay files, do not overwrite FYP source
Copy the zip content into the **root of a protected FYP hackathon branch/copy**. The archive adds:

- `backend/predictive_ai/` stand-alone training/forecast/FEFO simulation code.
- `CODEX_STEP_1_AUDIT_AND_TRAIN.md` first agent task.
- `CODEX_STEP_2_INTEGRATE_AND_BUILD.md` second agent task.
- this runbook.

No existing `backend/myapp` or `frontend/src` files are included or overwritten.

## What the GitHub default branch shows
The repository `CHplus2/grocery-ordering` was checked on 2026-10-10. It has `backend/myapp/models.py` with Product.stock, Order, OrderItem and a simple InventoryLog. It DID NOT contain RawMaterial, MenuIngredient or InventoryItem there. It may differ from your current **local working copy**. Codex must audit actual local code instead of presuming FEFO exists or adding duplicate definitions.

## Suggested terminal commands (PowerShell)
From FYP root after committing/saving existing work:
```
git switch -c hackathon/freshcast
```
Extract the archive **into the FYP repository root**, preserving the directory structure.
Add source files to `backend/predictive_ai/data/`:
- `train.csv`
- `meal_info.csv`
- `fulfilment_center_info.csv`

Original Genpact Food Demand Forecasting source:
https://www.analyticsvidhya.com/datahack/contest/genpact-machine-learning-hackathon-1/
Possible public mirror (verify terms):
https://github.com/devarti19/Food-Demand-Forecasting

Then open the entire FYP repository in Codex, and paste `CODEX_STEP_1_AUDIT_AND_TRAIN.md`.

Manual fallback with Python 3.12 installed:
```
py -3.12 -m venv .venv-ml
.\.venv-ml\Scripts\Activate.ps1
python -m pip install -r backend/predictive_ai/requirements-ml.txt
python backend/predictive_ai/train_model.py
python backend/predictive_ai/generate_demo_inputs.py
python backend/predictive_ai/predict_week.py
```
Model: `backend/predictive_ai/artifacts/demand_model.cbm`.
Metrics: `backend/predictive_ai/artifacts/metrics.json`.
Summary: `backend/predictive_ai/artifacts/demo_output.json`.

After training and verifying metrics, paste `CODEX_STEP_2_INTEGRATE_AND_BUILD.md`.

## Limitations / honest judge explanation
- Historical Genpact menu demand is WEEKLY; don't claim day-level per-batch expiry forecasting.
- Actual FYP menu/ingredient IDs may not match external dataset IDs. A manual, explicit mapping or separate demo catalog is necessary.
- The ML model only forecasts meal demand. FEFO, forecast-to-ingredient conversion, risk ranking, and purchasing recommendations are deterministic logic.
- Operational inputs created by the generator are synthetic, not original business records.
- Promotion correlation is not causal proof; what-if forecasts cannot guarantee uplift.
- Preserve existing FYP; avoid database resets, imports into production tables, or destructive migrations.
