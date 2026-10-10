# Codex second prompt — integrate trained forecasts into Dapur Kita

Proceed ONLY after `CODEX_STEP_1_AUDIT_AND_TRAIN.md` has produced a genuine model artifact and evaluation metrics.

Integrate as ADDITIVE Django REST API routes within existing project architecture, not a new FastAPI service. Keep the working app intact and do not change payment or checkout logic.

1. Inspect and follow the actual local Django setup (`backend/config`, `backend/myapp/urls.py`, existing auth rules). Create a small read-only service for forecasting and risk analysis. Load CatBoost model from `backend/predictive_ai/artifacts/demand_model.cbm`; handle missing artifact and invalid parameters with explicit errors, never fake results. Keep raw sales CSVs and model server-side.
2. Use `backend/predictive_ai/` scripts and service logic. Provide routes under a clearly separated prefix such as `/api/admin/predictive/` matching existing URL conventions. Candidate routes: GET metrics, GET centers, GET forecast, GET inventory risk; POST what-if simulation only for *nonpersistent* scenario inputs.
3. Avoid importing Genpact meal IDs as real Dapur Kita product IDs. If local actual Recipe/RawMaterial/InventoryItem models exist and their mapping is verified, offer an **opt-in** adapter; otherwise use demonstrably synthetic ingredient recipes and expiry batches, clearly marked DEMO. Do not invent real kitchen stock.
4. Calculate predicted menu orders x recipe quantity, FEFO projected allocation, ingredient-level expiry surplus and potential waste cost. Rank risks by RM amount and expiry urgency; explain each recommendation. 'Reduce purchasing' can be suggested conservatively; promotions must remain clearly marked speculative/what-if unless uplift was validated.
5. Build ONE new React admin page (`frontend/src/pages/admin/PredictionDashboard.jsx`) and add `/admin/predictive` to existing router/navigation. Reuse app styles/components and add only needed dependencies. It should display model metrics and baseline comparison, menu demand forecasts, source labels (real external dataset vs simulated operational data), top financial risks, expiry buckets, and scenario controls.
6. Protect admin APIs and screen following existing conventions. Handle loading/error/empty states. Avoid altering unrelated inventory CRUD, order processing, and payment flows.
7. Add tests for Django API permissions and output, risk ordering, no consumption after expiry, batch FEFO, and frontend build. Run existing backend checks and `npm run build`. Document commands and evaluated results in `DORMATHON_REPORT.md`.
8. State what code was pre-existing vs added for Dormathon and keep the hackathon work isolated on its branch. Do not claim the system has proven real-world savings or day-level forecasts.

Produce a working end-to-end demo from an actual trained forecast artifact; never replace missing data or a failing model with hardcoded 'predictions'.
