# A coherent public-data demo shop: executed feasibility check

## Answer to the data question

A store application can demonstrate forecasting using public transaction history
from a food business. Adopt that dataset's catalogue as a **public-data demo shop**,
retain its product identities, and connect forecasts for those same products to
explicit demo recipes and stock. This is more coherent than presenting an
unrelated Genpact forecast as the owner's own kitchen demand.

It does not establish accuracy for the owner's original menus or customers.
Renaming public foods to existing unrelated dishes changes labels, not customer
behaviour. Randomly generating more orders does not create observations of
demand. Structured synthetic history can exercise a pipeline, but evaluation on
it measures agreement with the generator, not performance in a real business.
Real data can still overfit; dated holdouts and comparisons against simple
baselines remain necessary. A simple seasonal model is still a predictive model.

## Dataset actually downloaded and checked

Publisher's dataset: [French bakery daily sales](https://www.kaggle.com/datasets/matthieugimbert/french-bakery-daily-sales)
by Matthieu Gimbert. The accessible mirror's
[README](https://github.com/ibaburbek/bakery_sales_pbi) describes bakery transactions.
An immutable mirror CSV was downloaded, parsed and hashed:

`https://raw.githubusercontent.com/ibaburbek/bakery_sales_pbi/e399f2b82d54e35c7e3d92d8b6d2b45425d45762/Bakery%20sales.csv`

SHA-256: `af5eede55b6eb2efb6bebb0e6dd1a51568c7eb73554d2f8ad2563081025681b2`.

Observed structure, rather than assumed README counts:

- **234,005 rows**, **136,451 ticket IDs**, **149 article labels**.
- `date`, `time`, `ticket_number`, `article`, `Quantity`, `unit_price`, plus an
  unused exported index column.
- Actual dates: **2 January 2021–30 September 2022**; 600 dates with records in a
  637-day span, leaving 37 calendar days with no records.
- 1,295 negative quantity rows; quantities are integral. Signed quantities are
  retained as adjustments in net daily totals, not silently deleted.
- 1,210 rows duplicate the business fields; they may be legitimate repeated
  lines or source duplicates. They remain as supplied; uniqueness is unverified.
- Prices are EUR strings. There are **no recipes, raw materials, inventory
  balances, batch expiry dates, supplier lead times or preorder delivery dates**.

The cloud proxy returned `Tunnel connection failed: 403 Forbidden` for the
original Kaggle API, while GitHub access succeeded. Consequently, original
publisher provenance and dataset licensing have not been independently verified;
the mirror's description is a claim, not an audit of customer transactions.
The dataset is not committed or redistributed in this repository.

## Actual CatBoost benchmark, 10 October 2026

Five named-food products were fixed for this experiment: `TRADITIONAL BAGUETTE`,
`BAGUETTE`, `BANETTE`, `CROISSANT`, `PAIN AU CHOCOLAT`. They cover 120,197 source
rows. Non-food/service labels such as `COUPE` were outside the scope.

The target is **net recorded units sold per product per source calendar day**.
Absent product/day rows mean zero recorded sales; this is not evidence of zero
latent demand, complete recording coverage or a planned closure.

Training: 2 January 2021–2 September 2022, 3,045 product/day rows.
Validation: **3–30 September 2022**, 140 product/day rows, **7,743 recorded units**.
Model parameters were fixed before evaluating the holdout: 400 iterations,
depth 6, learning rate 0.05, MAE loss, seed 42 and two threads.

| Method | Holdout WAPE | MAE, units/product/day |
| --- | ---: | ---: |
| CatBoost | 44.0743% | 24.3762 |
| Previous day | 41.0694% | 22.7143 |
| Previous week's same weekday | **30.5308%** | **16.8857** |
| Mean of previous four same weekdays | 75.0646% | 41.5161 |

**The fixed CatBoost candidate did not beat the best baseline. It is not deployed.**
This is not proof that learned models cannot improve on this dataset; it is a
negative result for this candidate. Do not tune repeatedly on September's results
and report the same holdout as untouched evidence. Future model selection should
use earlier rolling validation windows and require fresh evaluation evidence.
Do not translate WAPE into a claim of "percentage accuracy".

Features use product identity, known weekday/month/day index, shifted sales at
1/7/14/28 days, shifted rolling means and previous same-weekday means. No current
target, current transaction price or future quantity is a predictor. Validation
is rolling one day ahead using earlier actual days; these results do not validate
a simultaneous 28-day or current-calendar forecast.

The saved artifact was independently reloaded, its feature names checked, and
all 140 predictions verified finite with matching reported metrics.

Private files:

- `backend/predictive_ai/data/french_bakery_research.csv`
- `backend/predictive_ai/artifacts/bakery-research-2026-10-10/bakery_demand_model.cbm`
- Same artifact directory: `metrics.json`, `validation_predictions.csv`,
  `daily_recorded_sales.csv`.

These remain Git-ignored. Code, source checksum and executed results are committed.
After downloading the pinned CSV, reproduce from the repository root with the
existing locked ML environment and a new empty output directory:

```bash
python -m backend.predictive_ai.benchmark_bakery \
  --csv backend/predictive_ai/data/french_bakery_research.csv \
  --assume-recorded-zero-days \
  --output-dir backend/predictive_ai/artifacts/bakery-replay
```

The command verifies the source checksum, trains, saves and reloads the model,
then writes metrics. It never writes business database records, replaces Genpact
or deploys a model. CatBoost/numpy/pandas versions are recorded in the metrics.

## What a coherent migration would require — not implemented

1. Use an isolated demo database or dataset namespace, keeping the owner's
   existing transactions intact. Tag all public history as external demo data.
2. Keep the five bakery identities as the demo catalogue. Import daily sales
   aggregates as training history, without pretending retail tickets are paid
   Dapur Kita preorders or inventing delivery dates/customer accounts. Automated
   bulk import avoids manually entering thousands of orders; training needs
   3,185 aggregate rows for this scope, not 136,451 checkout records.
3. Add reviewed demo recipes and batches in consistent units. Label these as
   operational assumptions; they are not recovered from the sales dataset.
4. Add a model/seasonal-baseline adapter using the same product mapping and
   explicit historical replay dates. Keep paid confirmed preorders separate from
   estimated additional sales, avoiding double-counting.
5. Integrate the teammate's UI with a distinct source/schema and display model
   comparison, coverage, units and assumptions. A trained artifact alone does
   not connect the model to the current store or interface.
6. Verify the full demo and provision its bundle before switching the public
   application. Current Vercel endpoints remain Genpact; the separately tested
   local planning endpoint still calculates known bookings rather than ML demand.

This migration is feasible but is **not a completed integration or guaranteed
accuracy improvement**. For a late-stage demo, keep the working release available
until a replacement passes its complete walkthrough. Current useful components
already include model inference, staff APIs, FEFO, shortage/expiry calculations,
an interactive decision journey and hypothetical comparisons. More raw records
alone are not a substitute for connecting and explaining those components.
