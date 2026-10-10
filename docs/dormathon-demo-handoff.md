# Dormathon 2026 integrated demo handoff

## Current live data replacement — 10 October 2026

The owner explicitly confirmed that all existing orders are fictional demo/test
records and authorized replacing the live catalogue and past dishes/prices.
The Supabase rewrite **completed**, using the existing Vercel database settings
through the guarded one-off command, not by exposing database credentials or a
new HTTP write endpoint. Code source: `13f2dca` on `integration/dormathon-demo`.
Main and the developer feature branches were not merged or modified.

Live site: **https://preorder-freshness.vercel.app**. Deployment:
`dpl_CY9vBZKXUdMhYeGo3Y3KgSMf1UzY` (READY), with the usual live alias verified.
The deployment-specific build command was `python deploy/apply_dapur_kita_demo.py`;
the tracked normal build configuration and project build setting were unchanged.
Future normal releases do not run the rewrite.

Verified through authenticated live APIs after the transaction:

- **24 active menus**, **280 recipe links**, and exactly **three categories**:
  Rice meals, Noodles and Bakes. **19 retail products archived** and six old
  category labels removed from the replacement catalogue.
- All **35 guide raw materials** have the specified units and estimated costs.
  There are 36 material records in total: the old Almond material remains
  because it has a stock batch. No unrelated stock/history identity was reused.
- **23 orders / 50 items** mapped to the guide dishes, with correct new prices,
  subtotals, discount-adjusted totals and **643 accepted recipe links**. IDs,
  customer associations, dates, delivery dates, quantities, shipping fees,
  fixed discounts, order status and receipt/refund outcomes were preserved.
- **15 fictional payment events** reconciled. The summed food-order total
  changed from **RM773.50 to RM1,021.00** at the guide prices. These are fictional
  demo calculations, not observed sales of the replacement dishes.
- **23 durable before/after audit backups** in Supabase's `myapp_orderamendment`
  table; the first includes the original catalogue. All are readable through
  the existing staff accepted-recipe API. A private source-only catalogue/order
  backup in the Vercel deployment was read back and checksum verified (86,227
  bytes), providing a second copy while that deployment is retained. Neither
  backup is committed to Git or served as a public asset.
- All **three stock records unchanged**. Seventeen unsupported legacy
  consumption flags were cleared; preparation plans need review for the new
  recipes. No deductions, restocking, supplier facts or expiry dates were
  fabricated. **All 24 menus currently have zero usable stock**, so checkout
  requires suitable inventory entries first.

Validation: **52 Django tests**, **six release/packaging tests**, an exact-shape
isolated rehearsal of all 23 orders/50 items/15 payments, and the actual Vercel
frontend build passed. All five live predictive APIs passed authenticated
session/CSRF checks after the new deployment became live. The model is ready;
center 13/week 146 returned 51 forecasts and four risks. Total forecast orders
were 21,916.11 baseline and 49,246.95 in the promotion scenario. Saved held-out
WAPE remains **28.23% versus 34.81% baseline**; no retraining occurred. The exact
original 5,899,808-byte model bundle was privately read back and checksum verified.

HTTP checks for `/admin/products`, `/admin/orders` and `/admin/ai/decisions`
returned 200. A new remote Chromium UI walkthrough could not complete because
the cloud browser rejected the environment proxy certificate
(`ERR_CERT_AUTHORITY_INVALID`); HTTPS verification was not disabled. The APIs
were verified, but the newly populated remote tables need a manual browser
check. Earlier successful local UI checks are recorded below. React source
and styling were not changed in this data task.

FreshCast still forecasts **Genpact meal demand with simulated operational CSVs**.
Recasting the FYP catalogue/orders does not make the current model a forecast
of those menus or convert synthetic historical records into real training data.
See [catalogue import and rewrite instructions](DAPUR-KITA-CATALOGUE-IMPORT.md).
Rolling back deployment code does not roll back the Supabase data transaction;
restoration uses the durable before-snapshots as a separate reviewed operation.

## Earlier integration and local checks

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
