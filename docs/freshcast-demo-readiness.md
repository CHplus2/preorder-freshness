# FreshCast demo readiness — 2026-10-10

The backend is operational for an external Genpact, weekly, simulated-inventory
demonstration. The prediction UI is owned by the teammate and has not been
validated here. End-to-end dashboard readiness is therefore still pending.

## Verified by live HTTP

Django ran on loopback against a newly migrated isolated `/tmp` SQLite database,
dotenv disabled, DEBUG=False, an in-memory email backend and a throwaway staff
account. No production database or payment service was used. The real login and
CSRF flow was used, not force-authenticated requests.

All eight required files exist and are nonempty: model, metrics, three historical
CSVs and three SIMULATED operational CSVs. Django 6.0.3 and CatBoost 1.2.10 import
successfully together in the Python 3.13 environment.

All five staff endpoints returned HTTP 200: metrics, centers, forecast,
inventory-risk, and POST what-if. Centers returns 77 entries. Center 13, week
146 produces 51 predictions and four ingredient risks. Both baseline and
promotion-scenario predictions match separately loaded CatBoost inference to
1e-12 relative tolerance. Forecast demand in each risk independently matches
forecast orders multiplied by simulated recipe quantities. Only five meals have
simulated recipes; uncovered meals are explicitly warned about.

Saved held-out evaluation remains 28.23% CatBoost WAPE versus 34.81% baseline.
No retraining occurred during this verification.

| Simulated ingredient | Forecast kg | Unused expiry kg | Potential waste MYR |
| --- | ---: | ---: | ---: |
| Chicken | 691.81 | 1127.49 | 16912.37 |
| Rice | 795.62 | 1057.05 | 5285.24 |
| Vegetables | 957.97 | 172.35 | 1034.08 |
| Cooking oil | 96.50 | 92.72 | 834.52 |

These are fictional stock/cost risks, not actual restaurant losses or guaranteed
savings. All four ingredients have surplus in the base scenario. FEFO consumes
zero from ineligible expired batches.

Error checks: anonymous requests and session POST without CSRF returned 403;
unknown center, unsupported week, fractional/boolean IDs, duplicate/unknown
query fields and invalid scenario fields returned 400 `invalid_parameters`.
Center 10 returned 503 `operational_data_unavailable` because operations currently
cover center 13 only. A second isolated Django instance with an empty artifact
directory returned 503 `model_unavailable`; the original model was never moved
or deleted.

## What-if scope

POST `/api/admin/predictive/what-if/` accepts only `center_id`, optional `week`
and optional boolean `promotion_scenario` (default false). Setting true sets
both `emailer_for_promotion` and `homepage_featured` to 1 for eligible meals;
false sets both to 0. Historical lag features and last observed prices remain
unchanged. CatBoost demand, recipe requirements and hypothetical FEFO risk are
recalculated without persistence.

For this bundle the total across 51 meals changes from 21916.11 to 49246.95
predicted orders. This sensitivity is observational, **not measured causal
uplift** or a marketing guarantee. Recipe risks only cover the five mapped demo
meals. Price changes, custom quantities, discounts, supplier changes and causal
uplift controls are not supported; unknown request fields return 400.

## Preserve the exact evaluated model

The model and CSVs are excluded from Git. A fresh branch checkout has the code,
locked requirements and reproducible training instructions, but lacks the actual
bundle. The cloud filesystem and an archive on it are still ephemeral.

A transfer archive is prepared outside the checkout at
`/workspace/onboarding/preorder/freshcast-demo-bundle.tar.gz`, with SHA-256
sidecar and an internal per-file manifest. It contains all eight runtime files,
saved evaluation details, requirements and this guide. Extracting and hashing
all manifest entries verifies the transferred contents. Download/copy the archive
and its checksum to the demo laptop and at least one durable backup (team drive
or approved artifact store). Verify the archive checksum after transfer.

External preservation has **not** been confirmed. No external storage destination
was supplied. A read-only GitHub API probe returned `Forbidden`; therefore this
session did not upload a release asset or claim Git access implied API access.
To complete preservation, save the downloadable archive outside Codex or provide
an accessible artifact-store upload method. Neither Git commit nor reproduction
instructions preserve the exact trained bytes.

## Simplest reliable local demo

Use one laptop running Python 3.13 and Node 24. Keep the checked-out backend on
`feature/ai-backend`. When your teammate's dashboard is available in the agreed
demo checkout, verify it against the committed JSON contract; no branch merge
was performed in this task.

1. Extract the bundle into an external local directory, for example
   `freshcast-bundle`, and configure `PREDICTIVE_DATA_DIR` and
   `PREDICTIVE_ARTIFACT_DIR` to its absolute `data/` and `artifacts/` paths.
2. Create a Python 3.13 virtual environment. Install root `requirements.txt`
   and `backend/predictive_ai/requirements-ml.lock` into that same environment.
   On Windows use the virtual environment's `Scripts/python.exe`; on Unix use
   `bin/python`. Do not sync away Django when installing ML dependencies.
3. Disable dotenv loading (`PYTHON_DOTENV_DISABLED=1`), set a development-only
   `SECRET_KEY`, point `DATABASE_URL` at a new local SQLite file, set local
   `ALLOWED_HOSTS`, and use console/in-memory email. Do not copy production .env.
4. From the repository root run `python manage.py migrate --noinput` and
   `python manage.py createsuperuser` to create your own local staff account.
5. Run `npm ci --prefix frontend`, `npm run build --prefix frontend`, and
   `python manage.py collectstatic --noinput`.
6. Run `python manage.py runserver 127.0.0.1:8000 --noreload`, with DEBUG=False.
   Django serves the built React page and WhiteNoise static files; relative
   `/api/` requests use the same origin. Only one server is needed after build.
7. Log in locally, select center 13/week 146, confirm metrics and risks, toggle
   the promotion scenario, and verify all SIMULATED/UNMAPPED labels remain visible.

For active frontend development, run Vite separately on 5173 and Django on 8000;
the existing Vite `/api` proxy targets that backend. Use the same hostname
consistently for cookies. Preserve the normal CSRF flow for authenticated POSTs.

Download dependencies and the bundle and rehearse before the event; inference
uses local files and requires no external paid service. Existing Vercel deployment
has not been validated with native ML dependencies/bundle resource limits. A
local demo avoids that unverified deployment path. This guide makes no production
hosting readiness claim.

Remaining blockers: durable external bundle copy, and teammate dashboard
integration plus a real browser walkthrough. Generalization to Dapur Kita,
day-level forecasts, real-stock mapping and production deployment are outside
this verified prototype.
