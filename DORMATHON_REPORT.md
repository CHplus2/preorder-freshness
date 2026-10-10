# Dormathon 2026 backend audit

## Task 1: repository audit and shared contract

Active branch: `feature/ai-backend`, created from local `work` at
`049563326b195cdee66b3f5465ae9766ee862264`. Initial working tree and index were
clean. Origin is `https://github.com/CHplus2/preorder-freshness.git`; read-only
remote access succeeded. The user's branch instruction supersedes the older
`hackathon/freshcast` instruction in Step 1. React dashboard implementation is
owned by another developer on `feature/ai-dashboard`.

### Existing architecture

The current FYP has `Product`, `RawMaterial`, `ProductIngredient` (not
`MenuIngredient`), and `InventoryItem`. Recipe quantities use each material's
unit, including g/kg/ml/l/unit. Inventory has receipt and effective expiry dates,
quarantine/handling information and optional batch costs. Existing inventory and
order services already support FEFO; discovery orders lots by expiry and ID,
excludes expired/held/future-received stock, and considers preparation dates.
Existing daily paid-sales estimation in `myapp/services/forecast.py` is separate
from the Genpact weekly prototype and must remain unchanged.

Django uses `backend/config`, DRF staff permissions and existing session/CSRF
conventions. The root management entrypoint supports isolated test variables.
The React app has owner screens but no prediction dashboard route. The starter
under `backend/predictive_ai/` contains CatBoost training, historical features,
one-week prediction, simulated input generation and a pandas risk engine.
There is no predictive route, local product mapping, trained artifact or metrics.

### Source data and training gate

All required source files are absent from `backend/predictive_ai/data/`:

- `train.csv`
- `meal_info.csv`
- `fulfilment_center_info.csv`

The directory contains only the download instruction placeholder. No training,
simulated CSV generation or model prediction was attempted. No evaluation scores
exist. Step 2 explicitly requires a genuine model artifact and evaluation metrics;
Django model integration is therefore pending. Supply the original challenge
files locally, without committing them, before resuming.

### Starter review: issues to resolve with targeted tests before training

- Historical lag and rolling features shift within each center/meal series, so
  they exclude the current target. They mean prior **observations**, not necessarily
  adjacent weeks. Missing weeks are not proven zero demand; document gaps and
  compare last-observation baseline fairly using `weeks_since_last`.
- Holdout is the latest ten calendar weeks with earlier training rows. Validation
  uses actual previous observations in a rolling one-step evaluation, not a
  ten-week recursive forecast. Current covariate availability (prices/promotion
  known for next week) is an assumption that needs disclosure.
- Validate integer unique center/meal/week keys, finite nonnegative orders/prices,
  metadata completeness and enough distinct weeks. Numeric coercion to zero and
  categorical `Unknown` currently hide malformed input; improve explicit errors.
- Forecast covariates carry the latest observed prices and force both promotion
  flags to the supplied boolean. That differs from observed validation flags;
  describe the default and hypothetical scenario, not causal uplift.
- Risk engine silently drops meals without recipes and inventory-only ingredients.
  Surface uncovered recipes and zero-demand stock; validate units and quantities.
- Waste costs incorrectly use the first eligible lot's cost for all expiry surplus.
  Sum unused quantity times each expiring batch cost. Unknown cost must not become
  zero. FEFO ties need deterministic batch-ID order and allocation evidence.
- Supplier lead time is currently unused, safety-only reorder is illustrative,
  and shortage purchase cost is not known. A single risk label can hide simultaneous
  shortage and surplus. Recommendations must expose limitations.
- Validate nonfinite/negative inputs, expired consumption exclusions, recipe
  conversion, FEFO, missing artifact/source errors, chronological splitting and
  target leakage. Keep tests separate from production tables.

### Integration design and proposed changes

Use additive staff-only `/api/admin/predictive/` Django routes with a read-only
model service after training. No FastAPI, destructive migrations, stock deductions,
payment changes or automatic import of Genpact IDs. Start with clearly simulated
operational records. An actual recipe adapter needs a user-supplied mapping and
verified unit conversions. Load server-side CatBoost artifacts and return explicit
unavailable errors instead of invented predictions.

The shared JSON contract is in `docs/predictive-api-contract.md`; it explicitly
marks every endpoint proposed/unimplemented. Future changes will include starter
input validation and risk fixes, isolated ML tests, evaluated training outputs
(local/ignored), model service, Django views/URLs and staff/API tests. Keep contract
status and output fields synchronized as those endpoints become real.

Added for this task: this audit report, proposed API contract, persistent
collaboration guidance in `AGENTS.md`, updated Step 1 branch instruction, and
Git exclusions for forecasting CSVs/archives/artifacts and CatBoost logs.
All application/frontend code remains pre-existing and unchanged.

### Verification

See the task completion entry below for executed checks. Training, model metrics,
model-backed API checks and Genpact generalization are unverified while source
files are missing. Simulated operations cannot demonstrate real savings,
food safety, daily forecasts or supplier delivery reliability.

Task 1 executed checks (2026-10-10): `manage.py check` passed;
`manage.py test myapp --noinput` ran 206 tests, with 204 passing and two
PostgreSQL-only tests skipped, using dotenv disabled and in-memory SQLite.
`git diff --check` passed. `git check-ignore` confirmed all three source filenames,
model artifact, metrics and CatBoost logs are excluded. No model evaluation ran.

## Task 2: ML dependency preparation; source files still unavailable

On 2026-10-10, after the user reported downloading the source CSVs, this cloud
checkout was checked again on `feature/ai-backend` with a clean working tree and
index. `backend/predictive_ai/data/` still contained only its placeholder; all
three original CSVs were absent. A filesystem search found no matching CSVs or
archives in accessible `/workspace` or `/tmp` paths, including shared downloads.
The private daemon directory under `/tmp` was inaccessible and was not searched.
Local downloads do not establish availability in this cloud checkout.

Installed `requirements-ml.txt` into the separate `/workspace/venv-ml` environment
using Python 3.12.14, leaving Django dependencies and frontend untouched. Core
versions: CatBoost 1.2.10, pandas 2.3.3, NumPy 2.5.3, scikit-learn 1.9.1.
The root Django project requires Python 3.13; this Python 3.12 environment is for
standalone ML scripts only, as requested by Step 1.

Reproduction from the repository root:

```bash
UV_CACHE_DIR=/workspace/.cache/uv uv venv --python python3 /workspace/venv-ml
UV_CACHE_DIR=/workspace/.cache/uv uv pip install --python /workspace/venv-ml/bin/python -r backend/predictive_ai/requirements-ml.txt
UV_CACHE_DIR=/workspace/.cache/uv uv pip check --python /workspace/venv-ml/bin/python
```

Verification: dependency compatibility check passed; NumPy, pandas, CatBoost,
and scikit-learn imported successfully; WAPE arithmetic was checked against a
hand-calculated example; `num_orders` is excluded from model feature names.
These checks are not model training or a dataset leakage audit. The starter uses
shifted historical targets, but duplicates, chronology, metadata, missing weeks
and covariate assumptions cannot be validated against absent source records.

No training, model artifact, evaluation metrics or simulated operational inputs
were generated. Training and baseline comparison remain blocked until the three
original files are available in this cloud machine at
`backend/predictive_ai/data/`. No API implementation or frontend change occurred.

## Task 3: genuine Genpact training and chronological evaluation completed

This entry supersedes the missing-data blockers above. On 2026-10-10, all three
source files were downloaded over verified HTTPS from the user-specified
`https://raw.githubusercontent.com/devarti19/Food-Demand-Forecasting/master/`
URLs into `backend/predictive_ai/data/`. These are a public mirror of the dataset;
structural validation does not establish independent publisher provenance.

CSV validation passed: 456,548 sales records, 51 meal metadata records and
77 center metadata records. Required columns were present, no required cells
were missing, no duplicate center/meal/week keys existed, metadata joins were
complete, numerical values were finite, and orders/prices were nonnegative.
History covers weeks 1–145 and 3,597 observed center/meal series.
File SHA-256 hashes, schema, sizes, gap counts and leakage checks are saved in
local ignored `backend/predictive_ai/artifacts/dataset_audit.json`.

Executed training using the separate Python 3.12 ML environment:

```bash
/workspace/venv-ml/bin/python backend/predictive_ai/train_model.py
/workspace/venv-ml/bin/python -m backend.predictive_ai.evaluate_model
/workspace/venv-ml/bin/python -m unittest discover -s backend/predictive_ai/tests -v
/workspace/venv-ml/bin/python backend/predictive_ai/generate_demo_inputs.py
/workspace/venv-ml/bin/python backend/predictive_ai/predict_week.py
```

The existing trainer used CatBoost 1.2.10 with 200 iterations, depth 6, learning
rate 0.08, seed 42, four threads, and log1p order targets. Training used weeks
4–135 (415,010 rows); chronological validation used weeks 136–145 (32,821 rows).
No holdout-driven hyperparameter tuning or early stopping was performed. The
saved artifact is the evaluated model trained through week 135, not a model
refitted on all 145 weeks. Its week-146 demonstration uses available history
through week 145 as input features without retraining weights.

| Evaluation | WAPE (%) |
| --- | ---: |
| CatBoost | 28.2349399823 |
| Previous-observation baseline (`lag1`) | 34.8076211617 |

CatBoost improves WAPE by 6.57 percentage points, or 18.88% relative to baseline,
and beats it in each of the ten held-out weeks. The independent evaluation
script reloads `demand_model.cbm`, recomputes predictions, confirms they are
finite, and reproduces both saved aggregate metrics exactly to two decimals.
It saves per-week metrics and all held-out predictions locally.

Leakage checks passed on the downloaded data: current targets do not affect
their own feature vectors; modifying all held-out targets does not alter any
training feature; `num_orders` is excluded from the feature list. Six isolated
unit tests cover these invariants, observation-gap handling, future feature
shape, explicit missing-history/source errors, and WAPE arithmetic.

### Limitations and next work

There are 21,504 observation gaps longer than one week, with a maximum gap of
122 weeks. Lag and rolling features use previous observed rows; missing weeks
are not imputed as zero. Validation scores only observed center/meal/week rows,
not all absent combinations. Holdout prediction uses actual previous observed
orders as rolling one-step inputs, including observations from earlier holdout
weeks, which is valid for rolling prediction but not recursive multi-week
forecasting. There is no final independent test set or statistical confidence
interval, and repeated tuning on this holdout would compromise its independence.

Validation uses observed prices and promotion flags for each target week,
assuming they are known at forecast time. The future-row generator instead
carries latest prices and sets both promotion flags from a scenario switch;
this covariate mismatch limits extrapolation claims. Promotion flags are
observational, not causal uplift evidence. New/dormant items and missing demand
records require separate consideration. This weekly external dataset does not
prove generalization to Dapur Kita or daily demand accuracy.

The week-146 CLI prediction succeeded for center 13 using the actual trained
CatBoost artifact. The three generated operational CSVs are explicitly simulated
recipes, ingredient inventory/costs and supplier assumptions, not original
Genpact or real kitchen records. Predictions remain external meal IDs and are
not mapped to local FYP products. The CLI forecast includes unmapped meals while
risk calculation only includes the five simulated recipe meals; do not treat
that risk result as a complete center inventory assessment. The starter risk
engine issues from Task 1 (per-batch costs, incomplete recipe coverage,
inventory-only ingredients and deterministic tie order) still need correction
before API integration; this task establishes forecasting readiness only.

Local ignored artifacts:

- `backend/predictive_ai/artifacts/demand_model.cbm`
- `backend/predictive_ai/artifacts/metrics.json`
- `backend/predictive_ai/artifacts/dataset_audit.json`
- `backend/predictive_ai/artifacts/evaluation_details.json`
- `backend/predictive_ai/artifacts/validation_predictions.csv`
- `backend/predictive_ai/artifacts/demo_output.json`

Data and all model/evaluation artifacts remain excluded from Git. Only the
independent evaluation script, isolated feature tests, and documentation are
committed. No Django tables, payment logic, React files or API routes changed.
The API contract's availability section now reflects completed local training
while correctly marking routes unimplemented. Integration remains a later task.

## Task 4: artifact reproducibility and Django integration

Completed on `feature/ai-backend` on 2026-10-10. The genuine `demand_model.cbm`
was present (approximately 1.1 MB), loaded successfully by CatBoost in the Django
Python 3.13 runtime, and produced forecasts through the new staff-only APIs.
The model is still local/Git-ignored; no live deployment was performed.

Added routes under `/api/admin/predictive/`: GET `metrics/`, `centers/`,
`forecast/`, `inventory-risk/`; POST `what-if/`. The API contract now marks these
routes implemented. Prediction and scenario calculations are nonpersistent,
require staff access, enforce session POST CSRF, validate parameters, and
return explicit unavailable errors for absent/incompatible models, data or
simulated operations. Optional ML libraries load after permission checks and
bundle checks; ordinary FYP routes do not import CatBoost. The service caches
history/model per worker using file signatures and bounds inference threads.

No verified mapping connects Genpact meals to FYP products, so only explicitly
SIMULATED recipes, batches and suppliers are accepted. Current operations cover
center 13. Missing recipe coverage is reported; other centers return HTTP 503
rather than fabricated inventory. The service does not query or mutate FYP
inventory, order, payment or product tables. No migrations or frontend changes.

The risk engine now exposes batch-level FEFO allocation, deterministic batch-ID
ties, zero consumption for expired batches, ingredient stock with zero forecast
demand, per-batch surplus costs, unknown-cost warnings and null monetary totals,
ranked monetary/expiry/shortfall risks and explainable purchasing suggestions.
Supplier lead time and promotion uplift are explicitly unverified. Quantity and
cost validation rejects invalid values; duplicate recipe/batch keys are rejected.

Reproduction is committed as `backend/predictive_ai/reproduce.sh`, with exact
ML versions in `requirements-ml.lock` and fixed SHA-256 checks for the three
source CSVs. Executed the complete script successfully: dependency preparation,
source verification, CatBoost training, reload evaluation, simulated operations
and CLI predictions. It reproduced 28.23% CatBoost WAPE versus 34.81% baseline
on weeks 136–145. Source download into a fresh environment was verified in Task 3;
this repeat used and reverified the retained CSVs. Cross-platform byte identity
is not promised; retraining requires Python 3.12, uv/curl and network access.

Artifact availability and deployment instructions are in
`backend/predictive_ai/README.md`. Git does not transport ignored artifacts.
For another local machine, run the script or transfer model, metrics, three
source CSVs and three operational CSVs. Install optional locked ML dependencies
into the Django interpreter without synchronizing away its existing packages.
Use `PREDICTIVE_DATA_DIR` and `PREDICTIVE_ARTIFACT_DIR` to select external
server-side directories. Deploy the complete versioned bundle into the image
or a persistent read-only mount, provision dependencies, restart workers and
run authenticated smoke checks. Do not expose the raw data or model as static
assets. Existing hosting configuration is unchanged and requires separate
provider validation for native ML dependencies and bundle/resource limits.

Executed validation:

- Django system check and migration-drift check passed; no migrations needed.
- Full isolated SQLite backend suite: 211 tests, 209 passed, two PostgreSQL-only
  tests skipped. Five new tests cover staff/anonymous permissions, CSRF, genuine
  predictions and zero database queries during simulation, invalid parameters,
  and absent source/model handling.
- Eight standalone ML/risk tests passed, including FEFO and unknown-cost handling.
- Full reproduction/evaluation script passed with the same held-out WAPE.
- Frontend production build passed as required by Step 2; no React source changed.
- Git whitespace check passed; CSVs, CBM and generated outputs remain ignored.

Limitations from Task 3 remain: rolling weekly external forecasts, prior-observed
rather than necessarily prior-week lags, known-covariate assumptions, no causal
promotion claim or demonstrated real-world savings. Deployment to another host
and real local-product adaptation remain unverified. The evaluated weights remain
trained through week 135 and are not silently refitted on holdout weeks.
