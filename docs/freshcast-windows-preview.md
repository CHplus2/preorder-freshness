# See FreshCast: preview limits and Windows launch

The verified integration branch is `integration/dormathon-demo` at `3af4385`.
It contains `/admin/ai/decisions` and the staff FreshCast navigation entry. The
FYP home page remains unchanged by design. A production website or an older
Vercel deployment does not change just because this branch was pushed.

## Current cloud access

The built React app and real Django APIs are operational internally on port
8003, with an isolated local SQLite database and the existing trained bundle.
Chromium loaded the assistant via a real staff login and observed a successful
live forecast response. Model/data and ML dependencies are already present;
no retraining occurred.

This session exposes no browser-preview or port-forwarding capability. Internal
`127.0.0.1:8003` is on the cloud machine, not the user's laptop. It is **not an
accessible external preview URL**. No public/forwarded URL has been created.
A screenshot can show the rendered UI, but cannot provide manual interaction.

## Windows PowerShell launch

Prerequisites: Python 3.13 via the Python launcher `py`, Node 24/npm, and a local
checkout of the repository. Start PowerShell in that repository's root. Preserve
any local changes before switching; do not reset or force checkout.

**Bundle prerequisite:** provision these existing files below
`backend/predictive_ai/` before launching:

- `artifacts/demand_model.cbm` and `artifacts/metrics.json`
- `data/train.csv`, `data/meal_info.csv`, `data/fulfilment_center_info.csv`
- `data/recipes_demo.csv`, `data/inventory_batches_demo.csv`, `data/supplier_settings_demo.csv`

The model/data are Git-ignored and are not downloaded by `git fetch`. This chat
has no supported file-export/attachment tool, and workspace file links are not
usable downloads. Therefore copying the bundle to the laptop still requires an
accessible transfer route (workspace file export supplied by the product, or
an approved artifact store). Do not retrain as a workaround for this request.
If an external bundle is already on your laptop, configure the two directory
environment variables to its absolute `data` and `artifacts` locations instead.

Run these exact commands from the repository root after bundle provisioning:

```powershell
$ErrorActionPreference = 'Stop'
git fetch origin
git switch integration/dormathon-demo
if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed; preserve your local changes before continuing.' }
py -3.13 -m venv venv
if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.13 before continuing.' }
.\venv\Scripts\python.exe -m pip install -r requirements.txt -r backend/predictive_ai/requirements-ml.lock
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }

$env:PYTHON_DOTENV_DISABLED = '1'
$env:DEBUG = 'False'
$env:SECRET_KEY = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
$env:ALLOWED_HOSTS = 'localhost,127.0.0.1'
$env:PREDICTIVE_DATA_DIR = Join-Path $PWD 'backend\predictive_ai\data'
$env:PREDICTIVE_ARTIFACT_DIR = Join-Path $PWD 'backend\predictive_ai\artifacts'

$requiredData = 'train.csv','meal_info.csv','fulfilment_center_info.csv','recipes_demo.csv','inventory_batches_demo.csv','supplier_settings_demo.csv'
foreach ($name in $requiredData) {
    if (-not (Test-Path (Join-Path $env:PREDICTIVE_DATA_DIR $name))) { throw "Missing bundle file: $name" }
}
foreach ($name in 'demand_model.cbm','metrics.json') {
    if (-not (Test-Path (Join-Path $env:PREDICTIVE_ARTIFACT_DIR $name))) { throw "Missing bundle file: $name" }
}
New-Item -ItemType Directory -Force ..\freshcast-demo-state | Out-Null
$env:DATABASE_URL = 'sqlite:///../freshcast-demo-state/demo.sqlite3'
.\venv\Scripts\python.exe manage.py migrate --noinput
if ($LASTEXITCODE -ne 0) { throw 'Local demo migrations failed.' }
.\venv\Scripts\python.exe manage.py createsuperuser
npm ci --prefix frontend
if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
npm run build --prefix frontend
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
.\venv\Scripts\python.exe manage.py collectstatic --noinput
if ($LASTEXITCODE -ne 0) { throw 'Static collection failed.' }
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --noreload
```

Then manually open `http://127.0.0.1:8000/admin/ai/decisions`, use the existing
FYP login screen with your newly created staff account, select Live API,
center 13/week 146, and work through the ingredient decision steps. This URL is
on **your laptop after running the commands**, not a cloud preview link.
The single-server build avoids cross-origin issues. Never point this rehearsal
at production Supabase or import production .env files.

These Windows commands are adapted from the successfully verified Linux setup;
Windows execution itself was not available in this session. Native dependency
installation must succeed before claiming the Windows runtime works.

## Vercel preview investigation

The GitHub checks API for integration commit `3af4385` returned `Forbidden`.
No Vercel connector/log-fetch capability or deployment URL was available. Thus
the exact failed build cause is **unconfirmed**, and build log text was requested.

Repository evidence:

- `build.py` runs a read-only `migrate --check` under VERCEL=1. Missing/unreachable
  preview PostgreSQL configuration or pending migrations can stop the build.
  This is a diagnostic possibility, not the verified failure reason. No database
  operations against a remote environment were attempted.
- Django settings require PostgreSQL under Vercel; local SQLite is rejected.
- Root production dependency declarations do not install the optional CatBoost/
  pandas/NumPy ML bundle, and Git excludes the trained model and all source/demo
  CSVs. A plain Git deployment therefore lacks predictive prerequisites unless
  an independent provisioning step supplies them. This is a confirmed runtime
  readiness gap, not proof of why the preview build failed.
- React production compilation passed in the cloud. That does not prove Vercel
  build resources, variables, database connectivity or deployment packaging.

Inspect the failed deployment's build log before applying a fix. No production
redeploy, environment-variable change, migration, retraining or feature rebuild
was performed to address the failure.
