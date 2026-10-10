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
