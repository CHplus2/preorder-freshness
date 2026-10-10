# Executed local recorded-booking CatBoost experiment

## Actual result — 10 October 2026

A separate CatBoost model was trained successfully using a fresh, authenticated
database export at 21:24:57 local time. It contains **24 orders and 52 items**;
21 orders fall in completed calendar weeks and three current-week orders are
excluded. The earlier fulfilment audit remains blocked: its target is different.

This experiment's target is **total recorded ordered portions per creation week**
across the whole store, including ultimately cancelled and unpaid booking intent.
It does not predict fulfilled meals, revenue, individual dishes or raw materials.
No generated orders or backdated delivery dates were added. Missing completed
calendar weeks are explicitly counted as zero *recorded* bookings; verified zero
customer demand or complete recording coverage is not established.

The model learns from 21 earlier weeks, 13 April–31 August. The latest four
completed weeks, 7–28 September, are a chronological holdout with only **nine
recorded portions**. Across all 25 weeks, six have positive counts and 19 have
no records. Sparse history and the owner's confirmed fictional/test provenance
make these experimental results unsuitable as real-business accuracy evidence.

| Method | Holdout WAPE | MAE, portions/week |
| --- | ---: | ---: |
| CatBoost | 173.2306% | 3.8977 |
| Previous week's recorded quantity | 333.3333% | 7.5000 |
| Trailing four-week recorded average | **172.2222%** | **3.8750** |

**CatBoost did not beat the stronger simple baseline. It is not promoted.**
WAPE can exceed 100%; here total absolute error exceeds the small actual count.
The experiment does not prove that any method is reliable with this history.
Its scores cannot be directly compared with Genpact's scores: targets, data,
sample sizes and evaluation periods differ.

The saved model was independently reloaded and generated matching, finite
holdout predictions. It uses 100 trees, depth 3, learning rate 0.05, log1p target,
RMSE loss, seed 42 and two threads. Parameters were fixed before evaluating the
holdout. Predictors are shifted one-/two-week counts, shifted four-week average,
history length and known calendar-week sine/cosine. Current/future targets,
payment status, price rewrites, dish names and customer fields are not predictors.
Validation is rolling one week at a time using actual previous holdout counts;
it does not establish recursive forecasts or causal effects.

## Private saved files

- Snapshot: `backend/predictive_ai/data/local/booking-experiment-2026-10-10/snapshot.json`
- Candidate: `backend/predictive_ai/artifacts/local-bookings-2026-10-10/local_booking_model.cbm`
- Same candidate directory: `metrics.json`, `weekly_recorded_bookings.csv`,
  `validation_predictions.csv`.

All remain Git-ignored and private. The model and datasets are not pushed.
Metrics include the canonical snapshot SHA-256, dependency versions, features,
parameters, time split, explicit assumptions and `promotion_eligible: false`.
The model is not included in the original Vercel runtime bundle or loaded by
Django's five predictive APIs. Those still use the original Genpact model.

## Reproduce

Use Python 3.13 with `requirements-ml.lock` dependencies. From the repository root:

```bash
python -m backend.predictive_ai.train_local_bookings \
  --snapshot backend/predictive_ai/data/local/booking-experiment-2026-10-10/snapshot.json \
  --assume-recorded-zero-weeks --holdout-weeks 4 \
  --output-dir backend/predictive_ai/artifacts/local-bookings-replay
```

Use a new empty candidate output directory. The command refuses the original
Genpact artifact directory and never writes database records or deploys a model.
It saves, reloads and verifies the candidate before reporting success. Preserve
the minimal snapshot privately to reproduce this exact result after a reset;
re-exporting a changed database yields a new experiment, not the same dataset.
For export instructions, see [the local audit](LOCAL-PREORDER-TRAINING.md).

No per-dish demand claim can be inferred from the owner's historical menu
reassignment. Reconnecting kitchen stock should initially use confirmed
preorders and accepted recipes, while suitable local fulfilment history is
collected. Keep source labels honest and avoid double-counting confirmed
bookings as additional forecast demand.
