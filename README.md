# Dapur Kita — Home-Kitchen Preorders with FreshCast

**Dapur Kita** is a React and Django FYP application for a Malaysian home kitchen, connecting dated preorders, menus, ingredient recipes, stock batches and preparation planning.

**FreshCast** is its integrated kitchen decision assistant. It helps the owner spot ingredient shortages and potential waste, understand their causes, and compare purchasing decisions. The separate evaluated-model mode demonstrates food-demand forecasting using public historical data.

## Open the application

- **Dapur Kita storefront / FYP:** [Browse the menu](https://preorder-freshness.vercel.app/menu) — public entry point for menus and the customer preorder flow.
- **FreshCast / judge demonstration:** [Open the Decision Assistant](https://preorder-freshness.vercel.app/admin/ai/decisions?source=local) — staff entry point for connected kitchen planning.
- **Integrated source and this README:** [integration/dormathon-demo](https://github.com/CHplus2/preorder-freshness/tree/integration/dormathon-demo).

Owner screens require an existing staff account. Request demonstration access from the project team; credentials are not published in this repository. No merge into `main` is required to use the linked deployed demo.

## Dapur Kita FYP workflow

Customers browse menus, choose a delivery date and submit a preorder through the existing checkout. The kitchen owner manages menus and recipes, records ingredient batches and expiry evidence, reviews order/preparation schedules, and follows ingredient requirements through fulfilment. Pricing, contribution estimates and reports support operational review.

The [FYP user manual](docs/FYP-USER-MANUAL.md) explains the customer and owner screens; the [technical handoff](docs/FYP-TECHNICAL-HANDOFF.md) covers the wider implementation. The FreshCast workflow below is an additional integrated feature.

## FreshCast decision assistant

The decision assistant guides the owner through five steps: **Detect → Categorize → Prioritize → Explain → Decide**.

- Convert upcoming confirmed preorders into ingredient requirements using accepted recipe snapshots.
- Allocate dated inventory using first-expiry-first-out (FEFO), excluding expired, held and otherwise ineligible batches.
- Identify shortages, ingredients likely to expire unused, and estimated financial exposure where costs are known.
- Explain the contributing orders, quantities, preparation dates and batch eligibility.
- Compare a hypothetical purchase, including arrival date, expiry and unit cost, without changing stock or placing an order.

The surrounding FYP application provides menu, recipe, inventory, checkout, order and preparation-planning workflows. See the [FYP user manual](docs/FYP-USER-MANUAL.md) for those screens.

## Two distinct data modes

| Mode | Inputs | Output |
| --- | --- | --- |
| **My kitchen** — default | Database preorders, accepted recipes and inventory batches | Calculated requirements, shortages, expiry risks and purchase comparisons for known orders. No demand model is used. |
| **Genpact evaluated model demo** | Public historical weekly meal demand, prices, promotion flags and fulfillment-center information | Genuine CatBoost forecasts, with separately labelled simulated recipes, inventory and supplier assumptions. |

The hosted kitchen records are **fictional demo transactions stored in the database**, not evidence of real customer sales. The local planning flow does not predict additional future customers. Genpact meal and center IDs are not mapped to Dapur Kita menu items; the external model is not presented as an accurate forecast of this shop's customer demand. Frontend fixture mode is also labelled separately.

### Forecast evaluation

The deployed Genpact model was trained through week **135** and evaluated on chronologically held-out weeks **136–145** using prior-only demand features.

| Method | Held-out WAPE |
| --- | ---: |
| CatBoost | **28.23%** |
| Previous-observation baseline | **34.81%** |

WAPE is total absolute prediction error divided by total observed demand, multiplied by 100; lower is better. It is not classification accuracy, and the model does not outperform the baseline on every individual slice. Week 146 forecasts have no observed targets in this dataset. Evaluation uses rolling one-week-ahead history; it does not establish multiweek or own-store forecast performance. See the [data-source explanation](docs/FRESHCAST-DATA-SOURCES.md) and [demo runbook](docs/FRESHCAST-DEMO-RUNBOOK.md).

## Try the demo

1. Sign in as staff and open `/admin/ai/decisions?source=local`.
2. Check the planning window and coverage: only eligible paid, scheduled, undeducted preorders contribute to requirements. Review excluded orders rather than interpreting them as zero demand.
3. Select an ingredient and follow the five-step assistant. Inspect the linked preorder and inventory evidence.
4. Compare a hypothetical purchase using the material's displayed unit. Late arrival or expiry before preparation ends cannot cover the requirement.
5. Switch the data source to **Genpact** to inspect the separate evaluated-model example. `/admin/ai/inventory?source=live` also includes the illustrated inventory/rescue interface.

The runbook includes a dated example. Records and dates may change; refresh the kitchen data and use the current response rather than promising permanently fixed quantities.

## Run locally on Windows

Prerequisites: **Python 3.13**, **Node.js 24**, npm and Git. From the repository root in PowerShell:

```powershell
git switch integration/dormathon-demo
py -3.13 -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt -r backend/predictive_ai/requirements-ml.lock
npm ci --prefix frontend

# Use local SQLite instead of any inherited hosted database configuration.
$env:PYTHON_DOTENV_DISABLED = '1'
Remove-Item Env:DATABASE_URL, Env:VERCEL -ErrorAction SilentlyContinue
$env:SECRET_KEY = (& .\venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(50))")
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py createsuperuser
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

In a second terminal at the repository root:

```powershell
npm --prefix frontend run dev
```

Open `http://127.0.0.1:5173/admin/ai/decisions?source=local`. Vite forwards `/api` requests to local Django on port 8000, preserving the existing session login and CSRF protection. A new local database starts without the hosted demo records: configure menus, recipes, dated stock and reviewed preorders using the [FYP manual](docs/FYP-USER-MANUAL.md). Do not run these migration/setup commands against production.

### Trained-model bundle

Git does **not** contain historical CSVs, simulated operational CSVs, model weights or databases. My-kitchen planning works without the ML bundle; Genpact mode requires all eight matched runtime files, including `demand_model.cbm` and `metrics.json`.

Provision a verified bundle outside public/static assets and set server-side `PREDICTIVE_DATA_DIR` and `PREDICTIVE_ARTIFACT_DIR` to its directories. See [model reproduction and local provisioning](backend/predictive_ai/README.md) and the [current Vercel deployment guide](deploy/VERCEL.md) for checksum-verified bundle delivery. Do not retrain inside an API request, expose bundle credentials to React, or assume cloning the repository downloads the model.

## API and architecture

**React + Vite → Django REST API → session/staff authorization → database planning or CatBoost inference.**

The authoritative [JSON API contract](docs/predictive-api-contract.md) documents the five original predictive endpoints, held-out backtest, local planning and purchase scenario. UI response validation preserves source labels, native ingredient units and unknown costs. Hypothetical comparisons do not write inventory records.

## Verification

Use the isolated local database configuration above in a dedicated test terminal:

```powershell
.\venv\Scripts\python.exe manage.py test myapp --noinput
npm --prefix frontend test
npm --prefix frontend run test:predictive
npm --prefix frontend run test:ux
npm --prefix frontend run build
.\venv\Scripts\python.exe -m unittest discover -s tests -v
npm ci --prefix escrow --ignore-scripts
npm --prefix escrow test
```

Both GitHub application/escrow jobs passed for the payment-maintenance release. Local checks exercised the provisioned CatBoost model, database planning, purchase comparisons and browser flows. PostgreSQL-only concurrency tests require PostgreSQL; real-model checks are explicitly skipped when the bundle is absent. See [payment/CI verification](docs/FYP-PAYMENT-MAINTENANCE.md) and the [demo runbook](docs/FRESHCAST-DEMO-RUNBOOK.md) for evidence and limits.

## Scope and documentation

This project extends a pre-existing FYP; it was not built entirely from scratch during the hackathon. Forecasting data comes from an external public dataset. Store records, rescue exercises and inventory assumptions are labelled according to their source. Financial comparisons are estimates, not achieved savings or proof of food safety. Testnet escrow is a separate unaudited lab, not a checkout payment integration; see [escrow setup and rules](escrow/README.md).

- [Demo walkthrough](docs/FRESHCAST-DEMO-RUNBOOK.md)
- [API contract](docs/predictive-api-contract.md)
- [Current deployment and model bundle](deploy/VERCEL.md) — Production and Preview have separate settings; Preview still needs its own database configuration.
- [Connected kitchen planning](docs/LOCAL-KITCHEN-INTEGRATION.md)
- [FYP user manual](docs/FYP-USER-MANUAL.md) and [technical handoff](docs/FYP-TECHNICAL-HANDOFF.md)
- [Preserved FYP documentation index and background](docs/DAPUR-KITA-FYP-README.md)

Detailed FYP reports remain in `docs/`; this README is the entry point for reviewers and developers.
