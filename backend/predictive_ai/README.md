# Dormathon predictive backend

The optional CatBoost service runs inside the existing Django application. It
never imports Genpact IDs into FYP products or changes stock, orders or payments.
The React prediction dashboard is developed separately.

For the separate local preorder retraining audit and its current data blockers,
see [LOCAL-PREORDER-TRAINING.md](../../docs/LOCAL-PREORDER-TRAINING.md). The local
audit is preparation only; it never replaces the trained Genpact demo model.

## Reproduce after a reset

Prerequisites: Linux Python 3.12, `uv`, `curl`, and HTTPS access to
`raw.githubusercontent.com`, `pypi.org`, and `files.pythonhosted.org`. From the
repository root, run:

```bash
bash backend/predictive_ai/reproduce.sh
```

The script installs exact dependency versions from `requirements-ml.lock` into
`/workspace/venv-ml`, downloads absent original CSVs, verifies fixed SHA-256 hashes,
trains with seed 42, evaluates the reloaded model, generates explicitly simulated
operations, and verifies the model can generate week-146 forecasts. It checks
existing source files too; a checksum mismatch stops rather than overwriting
user data or accepting changed remote content. No credentials are required.
To use another machine, set `ML_ENV_DIR=/absolute/path/to/venv-ml` and
`UV_CACHE_DIR=/absolute/path/to/cache`. Existing Python 3.12 is required; `uv`
may otherwise need network access to obtain its managed Python runtime.

Source downloads come from the user-selected public GitHub mirror. Fixed hashes
protect repeat runs against content changes; they do not independently certify
publisher provenance. Training is deterministic by fixed data, seed, parameters
and dependency versions; byte-identical files across different platforms are not
promised. The original observed holdout scores are 28.23% model WAPE and 34.81%
previous-observation baseline WAPE. See `DORMATHON_REPORT.md` for limitations.

## Make artifacts available to Django locally

The trained model exists only on disk, not in Git. Fetching this branch elsewhere
does **not** fetch the CSVs, model, metrics or simulated operations. Either run
the reproduction script there, or securely copy the complete verified bundle:

- `data/train.csv`, `data/meal_info.csv`, `data/fulfilment_center_info.csv`
- `data/recipes_demo.csv`, `data/inventory_batches_demo.csv`, `data/supplier_settings_demo.csv`
- `artifacts/demand_model.cbm`, `artifacts/metrics.json`

By default Django reads those directories below `backend/predictive_ai/`. To
use an external bundle, set `PREDICTIVE_DATA_DIR=/srv/predictive/data` and
`PREDICTIVE_ARTIFACT_DIR=/srv/predictive/artifacts` in the server environment.
Install optional ML dependencies into the **same interpreter that runs Django**:

```bash
uv pip install --python /workspace/venv/bin/python -r backend/predictive_ai/requirements-ml.lock
```

Do not use `uv pip sync` on the Django environment: it would remove Django.
Python 3.13 Django plus these ML dependencies was tested in this workspace;
Python 3.12 remains the separate training environment. Main backend requirements
remain unchanged so ordinary FYP development does not require CatBoost.

Start Django normally using a nonproduction database for testing. Staff-session
requests to `/api/admin/predictive/metrics/` should return `model_status: ready`;
`centers/` returns the horizon and available centers. The generated operational
bundle covers center 13 only; request `forecast/?center_id=13&week=146` for the
initial demo. Other centers return `operational_data_unavailable` until explicitly
simulated operations are supplied for them. No fake stock is substituted.

## Deployment provision

A Git-only deploy currently lacks both ML dependencies and the ignored bundle.
Prepare/train/evaluate the bundle in a build or training job, then copy it into
the deployment filesystem/image or provision a persistent read-only server-side
mount. Install the optional locked ML requirements in the Django runtime, set
the directory variables if using a mount, and restart workers. Do not train
inside an HTTP request or depend on this Codex workspace remaining available.
Keep raw CSVs and artifacts out of public/static paths. Ship model, metrics and
matching data as one versioned release; verify integrity during transfer and
restrict write access. The service caches model/history per process and reloads
on changed file signatures; deploy bundles atomically and restart workers for
consistent release selection.

Run deployment smoke checks as staff against metrics and a forecast, verify
HTTP 403 for nonstaff, and check missing bundles produce explicit HTTP 503.
No live deployment or artifact upload was performed here. Existing Vercel/FYP
configuration is not automatically modified; its runtime must support CatBoost
native wheels and the bundle within hosting resource/package limits. A local
model test is not proof of deployment readiness on that provider.

An optional transfer archive can be created outside the checkout:

```bash
tar -czf /tmp/dormathon-predictive-bundle.tar.gz -C backend/predictive_ai \
  data/train.csv data/meal_info.csv data/fulfilment_center_info.csv \
  data/recipes_demo.csv data/inventory_batches_demo.csv data/supplier_settings_demo.csv \
  artifacts/demand_model.cbm artifacts/metrics.json
sha256sum /tmp/dormathon-predictive-bundle.tar.gz
```

## Verification

From the repository root:

```bash
/workspace/venv-ml/bin/python -m unittest discover -s backend/predictive_ai/tests -v
/workspace/venv-ml/bin/python -m backend.predictive_ai.evaluate_model
PYTHON_DOTENV_DISABLED=1 SECRET_KEY=local-test-only DATABASE_URL=sqlite:///:memory: \
  /workspace/venv/bin/python manage.py test myapp --noinput
```

The real-artifact Django smoke test requires the provisioned bundle. Unit and
permission tests run without it; report skipped smoke coverage distinctly.
See `docs/predictive-api-contract.md` for exact JSON fields and HTTP behavior.
