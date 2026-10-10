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

## Task 5: live HTTP demo verification without retraining

Verified all eight required runtime files exist and are nonempty; Python 3.13
imports Django 6.0.3 and CatBoost 1.2.10 successfully. Started Django against a
new isolated `/tmp` SQLite database, dotenv disabled, DEBUG=False and in-memory
email. A throwaway local staff account logged in through the real HTTP login/
CSRF flow. All five predictive endpoints returned 200. Center 13/week 146
returned 51 genuine predictions and four calculated ingredient risks; both
baseline and promotion predictions match direct model inference at 1e-12
relative tolerance, and recipe requirement arithmetic was checked independently.

Live negative checks passed: anonymous and CSRF-less session POST requests
returned 403; invalid centers/weeks/IDs, repeated or unknown fields and invalid
scenario flags returned 400. Missing operations for center 10 returned 503.
A second verification server using an empty artifact directory returned 503
`model_unavailable` without removing or changing the real model.

The what-if endpoint only toggles both observational promotion flags, retaining
latest prices/history and recalculating forecasts, recipes and FEFO. Center-13
predicted orders changed from 21916.11 to 49246.95 across 51 meals; this is not a
causal uplift estimate. Risks cover only five simulated recipe meals. The held-out
metrics remain 28.23% versus 34.81% WAPE; no retraining took place.

Prepared and verified a complete transfer archive with per-file SHA-256 manifest
at `/workspace/onboarding/preorder/freshcast-demo-bundle.tar.gz`, plus an archive
checksum sidecar. This remains on the cloud filesystem: **external durable
preservation is not confirmed**. No storage destination was supplied; a GitHub
API read probe returned `Forbidden`, so no release upload occurred. The user must
download/copy it to a demo laptop and durable backup, or provide an accessible
artifact-store upload method. Git excludes the actual bundle.

`docs/freshcast-demo-readiness.md` provides detailed HTTP results, simulated risk
values, artifact transfer and a local single-server demo plan. Recommend Python
3.13 Django with optional locked ML dependencies and the external bundle, Node
24 frontend build, collectstatic, then Django/WhiteNoise serving React and API on
one origin. The live local server served the existing React root and built JS/CSS
assets successfully. The teammate's prediction dashboard has not been integrated
or browser-tested here; full end-to-end GUI readiness remains pending.

No application/frontend code, model artifacts or data changed. No branches merged
and no production deployment occurred. Verification servers were stopped after
testing; the disposable credentials stayed outside Git.

## Task 6: final integration branch and real browser walkthrough

User explicitly authorized `integration/dormathon-demo` from latest remote
backend `ac967c2`, merging remote dashboard `bc8e5d1`. Merge was conflict-free;
backend API contract remained byte-for-byte unchanged. Existing React decision
assistant, navigation, dashboard and styling were preserved. Collaboration
instructions now reflect the authorized integration branch.

The merged checkout passed Chromium live-API staff-session checks across all five
endpoints, center 13/week 146, ingredient selection and five-step decision
journey, client-side financial assumptions, real promotion response, retained
selection, recommendation, forecast/inventory views, mobile width 390px,
loading/recovery, unsupported-center error and anonymous gate. No frontend
fixtures substituted for failed API requests. No JavaScript runtime errors.

Django check, 211 backend tests (209 passed/two PostgreSQL skips), eight ML/risk
tests, 12 predictive frontend tests, existing frontend utility/UX/planner/checkout
tests and production build passed. Model bundle was retained and loaded without
retraining. Full launch instructions and remaining limitations are documented in
`docs/dormathon-demo-handoff.md`. External exact-bundle backup remains deferred;
no production deployment or merge into main occurred.

Repeated the real browser walkthrough successfully against a freshly started
Django-only server serving the integrated production React build after
collectstatic: loading recovery, all five real endpoints, decision journey,
promotion/worksheet, mobile, error and authentication checks passed. This validates
the recommended single-origin local demo configuration.

## Task 7: visible preview request and Vercel evidence

Confirmed the current `integration/dormathon-demo` checkout is clean and contains
FreshCast navigation and `/admin/ai/decisions`. Reverified the running Django-only
application internally on port 8003 using staff-session Chromium and a live
HTTP 200 forecast, and captured a current rendered screenshot. No retraining,
feature changes or remote data changes.

No external browser-preview/port-forward capability exists in this session,
so no user-accessible URL was fabricated. Workspace file paths are not usable
attachment downloads. `docs/freshcast-windows-preview.md` provides full Windows
PowerShell commands for safe local startup, explicitly gated on transferring
the already-trained model bundle; Windows itself was not executable here.

GitHub's checks API returned Forbidden, preventing retrieval of the failed
Vercel preview logs. Its exact failure cause remains unconfirmed. Configuration
inspection identifies a read-only PostgreSQL migration-check build gate and a
confirmed omission of optional ML dependencies and ignored artifacts from a
plain Git deployment. These are kept separate from the unobserved build error.
Deployment log text was requested; no production deploy or migration performed.

A concurrent remote update `3c51468` added a GitHub Actions downloadable-bundle
workflow. Preserved it by rebasing only the local documentation commit onto the
updated integration head. The workflow's execution/success is unverified; it
regenerates a bundle rather than exporting exact cloud model bytes. No workflow
was triggered by this session, and no force-push was used.

## Task 8: deployment investigation and tested container candidate

The user's live `source_data_unavailable` message agrees with deployment source:
CSV/model artifacts are Git-ignored, and existing Vercel build/dependency
configuration does not provision them or install the optional ML runtime. The
previous build log's missing PostgreSQL DATABASE_URL is a separate Preview
configuration failure. No production settings were altered.

Latest remote integration head was fetched and matched `7f9ecfa`. Access to
GitHub Actions/logs, Vercel docs/API and the live website remained blocked:
GitHub returned Forbidden; live HTTPS CONNECT returned proxy HTTP 403 (envoy).
Thus no claim is made about the Actions artifact's success or live authenticated
API/browser tests. Exact Vercel function fit remains unverified. A cloud-network
draft was saved adding api.github.com, api.vercel.com, vercel.com and the live
site hostname, preserving package presets. It requires user review/save/publish
before affected access can be retried. This does not change production settings.

Prepared the existing full Django+React app as a container deployment candidate,
with inference-only runtime requirements, Gunicorn startup, and safe checksum-
verified provisioning of an existing bundle from a mount or HTTPS artifact URL.
No scikit-learn/training/notebook runtime requirements are added; supported
CatBoost dependencies remain intact. No new API/auth flow or UI features.
Docker context excludes CSVs/models, credentials, databases and generated output.
Startup does not train or run migrations. Signed artifact URLs are not logged;
TLS, fixed archive hashes, size limits and safe member checks are enforced.
Versioned destination prevents overwriting active model inputs.

Docker build passed after diagnosing container DNS and TLS trust. Used supplied
proxy address mapping and approved CA via temporary BuildKit secret; never
disabled TLS verification or copied credentials/trust secrets into the image.
The built image's Python packages occupy about 797 MB; representative runtime
memory was about 585 MiB. These measurements support the container-host proposal,
not an unverified Vercel serverless compatibility claim.

Mounted a freshly checksum-verified copy of the existing eight runtime files
read-only into the candidate container, with a separate copied local SQLite
demo database. Model SHA remained b7608c307e17bb6d2b5b4ca15c4e495394cc405035de8c947522574da28b91a9;
no retraining or production database access occurred. Chromium on the container
passed all five real endpoints, the five-step ingredient journey, worksheet,
promotion comparison, selection retention, recommendation, forecast/inventory,
mobile layout, loading recovery, operational error and authentication gating.
Seven repository/provisioning tests passed, including archive integrity,
traversal rejection, required files and no-overwrite behavior. Original WAPE
remains 28.23% versus 34.81% baseline.

Deploy instructions and measured evidence are in `deploy/README.md`. No external
artifact upload, hosted preview, production routing change or promotion occurred.
A preview-host choice/access and secure artifact upload path remain missing;
network changes must be activated before remote investigation/testing resumes.
Production promotion requires the user's approval after a real hosted preview
passes. The live prototype is not yet verified ready for judging.

## Task 9: Render preview candidate

The user selected Render. Added a candidate root Blueprint for the integration
branch, manual deploys, a standard paid service targeting at least 2 GB memory,
and a 1 GB persistent disk. Current pricing, plan allocation and provider-side
schema validation remain unverified because Render docs/API HTTPS CONNECT returned
proxy HTTP 403. No service or billable resource was created.

Dedicated `config.render_preview_settings` retains the existing application,
restricts the preview to its own `/var/data/freshcast-demo.sqlite3`, rejects other
database URLs, scopes hosts/origins to the Render hostname, enables HTTPS session
and CSRF cookies, and keeps email in memory. Existing production settings, API
contract, teammate React sources and model weights are unchanged.

The Docker candidate rebuilt successfully with approved TLS trust and reused
the unchanged frontend/dependency build layers. Nine deployment tests passed,
including production-database refusal, host restriction, HTTPS CSRF settings,
archive integrity and existing Vercel release/entrypoint checks. A Docker run
using the actual Render settings, copied isolated test database and read-only
verified model bundle passed all five predictive endpoints through a genuine
staff login with CSRF enforcement (Django test client simulating HTTPS, not a
Render-hosted browser). The session cookie is secure; real CatBoost baseline
total remains 21,916.11 orders with four ingredient risks, promotion total
49,246.95 orders. WAPE remains 28.23% versus 34.81%; no retraining occurred.

`deploy/RENDER.md` explains isolated initialization, artifact transfer, startup,
manual acceptance and the production approval gate. The model/archive still
exist only in this cloud workspace; secure upload has not occurred. Render
account/workspace access, a secure artifact upload route and approval of actual
service/disk charges remain prerequisites. No hosted URL or judging-readiness
claim is made. Saved cloud configuration adds Render network domains and scoped
RENDER_API_KEY plus RENDER_OWNER_ID requirements; review/save/publication remains
outstanding. These are Codex environment requirements, not production settings.

## Task 10: free-demo constraint and direct Vercel candidate

The user declined paid Render hosting and requested direct Vercel hosting.
No Render resource was created. The existing paid Blueprint is marked unused.
Vercel docs and the live FreshCast HTML route are now reachable (HTTP 200), unlike
the earlier proxy denial; hosted staff/API inference remains unverified.

Current official Python/functions docs establish a 500 MB standard Python
bundle limit, Hobby memory 2 GB, and a 5 GB Large Functions public beta with
Fluid Compute/Active CPU. Existing projects opt in with the project environment
variable VERCEL_SUPPORT_LARGE_FUNCTIONS=1. The tested runtime's about 797 MiB
packages motivate this route; project eligibility and actual Vercel build size
are still not verified. No paid plan or production setting was enabled.

Added tested inference dependencies to Vercel's authoritative pyproject manifest,
secure checksum-verified build-time bundle provisioning after the existing
read-only database gate, explicit private function input inclusion and additional
virtual-environment/test exclusions. The build helper preflights all collisions,
keeps identical files unchanged and refuses to overwrite differing local inputs.
Model and CSV files remain ignored; frontend, model weights and API contract
are unchanged. No training or automatic migrations occur.

Eleven deployment tests passed. The actual eight-file original archive was
checksum-verified and staged into a new offline Vercel rehearsal directory;
its trained-model SHA-256 is unchanged. WAPE remains 28.23% vs 34.81% baseline.
No Vercel build or staff browser/API verification on the live domain is claimed.

GitHub Actions metadata is now readable: run 38034208941 on the prior 8e6df60
commit failed at `python manage.py test myapp --noinput`. The log download redirects
to a separately blocked Actions results host, so its exact failure is not yet
diagnosed. This existing remote CI failure is separate from the eleven local
deployment tests and must not be described as passing.

Saved scoped VERCEL_TOKEN and project/org ID requirements in the cloud draft.
Existing credentials were checked by name/presence and were absent. Secure
account/project access, an authorized archive upload destination and Preview
PostgreSQL bindings are still prerequisites. deploy/VERCEL.md explains the exact
settings and same-platform Preview acceptance/promotion procedure. Production
settings, data and deployment remain untouched. The judging demo is not yet
verified ready online.

## Task 11: direct upload path for the existing trained bundle

The user asked why model deployment cannot proceed independently of the dashboard
merge. It can. PR #4 was still OPEN at this check, but the original model bundle
was staged under ignored `.freshcast-deploy/runtime-bundle.tar.gz` and verified
against digest 697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a.
The direct Vercel build now auto-detects this uploaded archive and verifies it
without needing an external artifact URL. Git/Docker ignore it; CLI upload has an
explicit allowlist; the final function excludes the archive while including the
eight verified private runtime inputs. No model or dataset was committed.

Twelve deployment tests passed, including a corrupted direct archive failing
without publishing files. The actual no-argument provisioner discovered the
original local archive, verified all inputs and preserved identical source files.
Model SHA-256 remains b7608c307e17bb6d2b5b4ca15c4e495394cc405035de8c947522574da28b91a9;
original evaluation WAPE remains 28.23% versus 34.81%. No retraining occurred.

Installed Vercel CLI 62.7.0 and diagnosed local config/cache paths. `whoami`
reports logged out and `deploy --dry` reports no existing credentials. Source
upload selection, linking, provider packaging and hosted inference are therefore
unverified. Required Vercel account access is already recorded in the cloud draft.
The direct Production-environment route can use --prod --skip-domain to reuse the
existing Production bindings before assigning the live domain; no new Preview
configuration or Render payment is necessary. Preserve the original approval
requirement for concrete production changes/promotion. No deployment occurred.

GitHub metadata additionally confirms an existing successful downloadable-bundle
workflow run 38030646738 and artifact 11661229551 (30-day retention). That workflow
previously retrained a bundle; it was not dispatched here and exact equivalence
to the original cloud weights is unverified. Its signed download redirects to
productionresultssa2.blob.core.windows.net, which the proxy blocks. Do not call it
an exact original-model backup. Repository/Production Actions-secret metadata
returns Resource not accessible by integration (403), despite repository-role
metadata showing admin. GitHub access is not Vercel credential access.

## Task 12: deploy the original model bundle on Vercel

Scoped Vercel project access was supplied securely and verified. The original
archive was uploaded as private deployment source, using Vercel SDK ignore rules
and the supported file/deployment APIs. No .env or database was uploaded. The
Production-target candidate dpl_Ba3dM3DM9RpavB5q9azYaBUPbgBb (integration 7b190c3)
reached READY on the existing Hobby project with Fluid Compute and Large Functions
beta. The build verified eight runtime inputs; no training or migrations ran.
The public preorder-freshness.vercel.app alias remained on its previous deployment;
autoAssignCustomDomains was false. The candidate URL is recorded in deploy/VERCEL.md.

Authenticated source readback returned the exact original 5,899,808-byte archive,
SHA256 697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a. The model
bundle is therefore preserved outside Codex while Vercel retains that deployment.
This is not a permanent-storage guarantee or an automatic Git-build provisioner.
Hosted staff predictions still require verification; Codex egress blocks the
candidate hostname and Vercel/FYP authentication is retained. A user screenshot
shows chicken values matching the real-model local calculation, unlike the
frontend fixtures, but does not by itself verify all hosted endpoints.

## Task 13: integrate the latest illustrated pantry UI

Merged feature/ai-dashboard head 7efaee4 into integration/dormathon-demo, whose
prior head was 7b190c3. The merge was clean. Teammate changes add the illustrated
FreshCast Pantry, four ingredient crates, API-based visual ingredient evidence,
plain-language summaries and the final verification checklist. No backend API
schema, forecasting implementation or teammate-authored component was rewritten.
The authoritative docs/predictive-api-contract.md is unchanged.

Validation: twelve predictive JavaScript tests, the existing frontend test script,
five Django predictive tests (including real model, permissions, CSRF, invalid
parameters and missing files), and the frontend production build passed. A real
Chromium walkthrough used the existing staff login endpoint and an isolated
SQLite database with actual model/API responses, without request interception or
mock responses. All five endpoints returned valid data. Pantry ingredient
selection, all five journey steps, visual evidence and UI-triggered promotion
POST succeeded. A 390px mobile layout had no horizontal overflow and no browser
page errors. Screenshots/reports are local review artifacts, not committed data.

Actual model totals remain 21,916.11 baseline orders and 49,246.95 hypothetical
promotion orders, with four simulated ingredient risks. Chicken's 1,819.30kg
simulated eligible stock minus 691.808559kg forecast ingredient need leaves
1,127.491441kg expiring unused; at simulated RM15/kg the exposure is RM16,912.37.
Only five Genpact meal IDs have simulated recipes; 46 unmapped meals are disclosed
and excluded from ingredient need. These estimates do not use website orders or
local inventory. Existing model hash and holdout WAPE remain unchanged: 28.23%
versus historical baseline 34.81%. No retraining occurred.

The updated source/model-backed Vercel candidate will be uploaded separately from
Git so the ignored bundle is included. Hosted manual validation and live-domain
promotion remain separate steps; do not merge main or promote automatically.
