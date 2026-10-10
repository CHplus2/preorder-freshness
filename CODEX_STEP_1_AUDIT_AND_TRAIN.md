# Codex first prompt — audit and train (Dapur Kita / Dormathon)

You are working inside my existing Software Engineering FYP repository, NOT a new greenfield web app.

## Critical constraints
- Work on `feature/ai-backend` for Dormathon 2026. Preserve all uncommitted work. Commit tested task changes and push to `origin/feature/ai-backend`; never push to main, force-push, or automatically merge.
- Preserve the current FYP features, checkout, wallet/payments, authentication, FEFO, inventory logs, admin screens and database. NO destructive migrations, database resets, data deletion, or payment/API calls.
- First inspect the actual LOCAL code and model definitions; do not assume the GitHub default branch matches this working copy. The GitHub main branch previously examined had only Product.stock and did not show RawMaterial, MenuIngredient or InventoryItem. Determine if newer FYP inventory models exist here. Report what you found.
- I am adapting a hackathon-only `backend/predictive_ai/` starter. Treat its Python code as a starting point, review it for bugs, DO NOT build a second FastAPI backend, and do not train on fabricated sales without explicit demo labeling.
- Do not merge external Genpact meal IDs into my Product IDs unless I provide a mapping. Treat the Genpact-based forecasting demonstration as separate from production FYP data unless mapped explicitly.

## First task: inspect and plan, then do the model work
1. Inspect `backend/myapp/models.py`, `backend/myapp/urls.py`, views/services, Django settings, FYP inventory/recipe functionality, and `frontend/src/App.jsx`.
2. Review all files under `backend/predictive_ai/`. Output a short finding: schema available, missing links, integration design, file changes proposed.
3. Check `backend/predictive_ai/data/` for EXACTLY the 3 original Genpact files: `train.csv`, `meal_info.csv`, `fulfilment_center_info.csv`. If missing, tell me exactly which CSVs are missing and DO NOT falsely claim training succeeded.
4. Create/activate a separate Python virtual environment if dependencies collide with existing Django requirements. Prefer Python 3.11 or 3.12. Install dependencies in `backend/predictive_ai/requirements-ml.txt`. Do not modify main backend requirements until compatibility is verified.
5. Run `python backend/predictive_ai/train_model.py` from repository root. Check the trained artifact in `backend/predictive_ai/artifacts/demand_model.cbm` and `metrics.json`. Evaluate using later weeks held out chronologically; compare WAPE to lag-1 baseline, disclose if baseline wins. Validate feature leakage and check assumptions about missing series weeks.
6. Run `python backend/predictive_ai/generate_demo_inputs.py`, then `python backend/predictive_ai/predict_week.py`. The operational CSVs are SIMULATED recipes, batch quantities, costs and supplier data, NOT actual restaurant records. Confirm model predictions are from the trained CatBoost model; never hardcode predictions.
7. Add targeted tests for forecast input shapes, recipe-to-ingredient conversion, FEFO order, expiry exclusions, and meaningful error messages. Make tests runnable without touching production FYP tables.
8. At end, report training metrics, paths of generated files, which features are genuine/simulated, known dataset limitations, and next steps. Only claim completed actions if executed successfully.

## Forecasting rules
- Genpact data is WEEKLY for multiple fulfilment centers and generic meal IDs, NOT daily, and does NOT contain expiry batches or actual recipes.
- For MVP support a ONE-week-ahead forecast. For expired raw materials, use weekly expiry buckets; do not assert an exact day-by-day spoilage date.
- Promotion effect from observational flags is not proven causal uplift. Flag 'what-if' outputs as assumptions, not guaranteed savings.
- Do not promise that this dataset generalizes to Dapur Kita. It is a prototype built from external historical business data.

Start by showing the inspection findings and proposed files, then proceed with preparing/training only if the three CSV files exist. Do not start frontend implementation until model training and validation work.
