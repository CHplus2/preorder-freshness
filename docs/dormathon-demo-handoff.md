# Dormathon 2026 integrated demo handoff

Branch: `integration/dormathon-demo`. Merged remote backend `ac967c2` and
remote dashboard `bc8e5d1`. The merge was conflict-free. The backend's committed
predictive API contract is unchanged and authoritative. Both developer branches
and main remain untouched. FreshCast's existing navigation opens
`/admin/ai/decisions`, the five-step Decision Assistant; analytics are secondary.

## Verified integration

The real model and all eight runtime files were already provisioned. No
retraining took place. CatBoost loads in Django's Python 3.13 runtime. Live mode
uses actual staff-session HTTP requests, never fixture fallback. Existing FYP
login/session/CSRF behavior is preserved.

Chromium browser checks on the merged checkout passed:

- Live model-backed metrics, centers, forecast and inventory views; all five API
  endpoints including promotion POST returned HTTP 200 and passed React response
  validation without runtime JavaScript errors.
- Center 13, week 146, 51 meal predictions, four simulated ingredient risks,
  backend-ranked recommendations and FEFO evidence. Original held-out metrics
  remain 28.23% model WAPE versus 34.81% previous-observation baseline WAPE.
- Selecting rice, moving through all five steps, entering hypothetical action
  cost/waste-avoidance assumptions, calculating a real promotion what-if,
  retaining ingredient/step selection and reviewing the recommendation.
- Forecast and inventory navigation, a 390px mobile layout without page overflow,
  and visual inspection of the mobile assistant. Desktop was exercised at the
  browser's default 1280px viewport.
- Delayed live metrics response renders loading state then recovers. Unsupported
  center 10 shows the explicit operational-data error instead of fixtures.
  Anonymous access uses the existing authentication gate.

Testing used an isolated SQLite database and throwaway staff account; no
production services, payments or data were used. Browser testing used temporary
ports 8002/5174 to avoid existing listeners, with a proxy and trusted origins
configured outside the checkout. Normal demo ports remain 8000/5173.

Checks passed: Django system check; full backend suite (211 executed, 209 passed,
two PostgreSQL-only skips); eight standalone ML/risk tests; 12 predictive frontend
tests; the existing frontend utility tests and UX/planner/checkout checks; and
the production frontend build. Vite reports the existing large-chunk warning,
which did not prevent compilation.

## Launch locally without retraining

Use Python 3.13, Node 24 and uv. From the checked-out repository root:

```bash
git switch integration/dormathon-demo
uv venv --python 3.13 venv
uv pip install --python venv/bin/python -r requirements.txt -r backend/predictive_ai/requirements-ml.lock
source venv/bin/activate
npm ci --prefix frontend
npm run build --prefix frontend
```

Provision the **existing evaluated bundle**, without retraining: the model,
metrics, three original CSVs and three simulated operational CSVs must be under
`backend/predictive_ai/artifacts/` and `backend/predictive_ai/data/`, or set
`PREDICTIVE_ARTIFACT_DIR` and `PREDICTIVE_DATA_DIR` to external absolute paths.
The cloud checkout currently has them; a fresh Git checkout does not.

Create a separate local demo database and staff account:

```bash
demo_state_dir="$(cd .. && pwd)/freshcast-demo-state"
mkdir -p "$demo_state_dir"
export PYTHON_DOTENV_DISABLED=1 DEBUG=False
export SECRET_KEY=local-demo-only-not-for-production
export DATABASE_URL="sqlite:///$demo_state_dir/demo.sqlite3"
export EMAIL_BACKEND=django.core.mail.backends.locmem.EmailBackend
export ALLOWED_HOSTS=localhost,127.0.0.1
python manage.py migrate --noinput
python manage.py createsuperuser
python manage.py collectstatic --noinput
python manage.py runserver 127.0.0.1:8000 --noreload
```

Open the local application, use its existing login to sign in as that staff
account, and navigate to `/admin/ai/decisions`. Django serves the built React
application and relative API requests on one origin. For frontend development,
run `npm run dev --prefix frontend -- --host 127.0.0.1 --port 5173 --strictPort`
in another terminal and use that origin; the existing proxy routes API calls
to Django on 8000. Use one hostname consistently for session cookies.

The shell examples target Unix. Windows requires equivalent environment-variable
commands and `venv/Scripts/python.exe` instead of `venv/bin/python`.

## Demo story and limitations

Detect forecast-based ingredient surplus/shortage; categorize the issue;
prioritize using backend monetary/expiry/shortfall ranking; explain quantities
and assumptions; decide by comparing options in the assistant. Genpact demand
is genuine model inference, while recipes, stock, supplier assumptions and costs
are explicitly SIMULATED and unmapped to FYP products. Worksheet values are
user assumptions and stay client-side. No purchase, stock change or promotion
is executed.

What-if toggles both promotion flags and recalculates predictions and risk;
it does not support price/stock/recipe edits or establish causal uplift.
Only center 13 currently has operational inputs; only five meals have simulated
recipes, with other meal IDs explicitly reported as uncovered. Weekly expiry is
not a daily spoilage or food-safety measurement. Forecasting weights are the
previously evaluated model trained through week 135, not refitted on holdout.

The integrated demo works in this provisioned environment. Remaining portability
blocker: exact trained files remain Git-ignored and are not confirmed backed up
outside Codex. Backup was explicitly deferred by the user. No file-export tool
is available here; workspace paths must not be presented as usable downloadable
attachments. A reset can recover by the committed reproduction script, which
requires downloads and retraining; preserving exact existing bytes requires an
external artifact-transfer route. No production deployment or main merge was
performed. Visual checks are representative, not a complete device/accessibility
or production-hosting certification.

The complete browser walkthrough also passed with Django serving the production
React build and APIs on one origin after collectstatic and a fresh server start.
This verifies the recommended single-server demo mode, not just Vite development.
Restart Django after replacing/collecting new static assets; production-mode
WhiteNoise discovers files at process startup.
