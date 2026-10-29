# Original Genpact model recovery check — 29 October 2026

The original model was downloaded from the owner's GitHub Release, checksum
verified and restored to a new directory outside the checkout. No model was
trained. No production database, kitchen account, order, stock or payment was
accessed or changed. The archive and extracted data/model remain uncommitted.

## Actual artifact results

- Archive SHA-256:
  `697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a`.
- Historical source: 456,548 rows and 77 centers.
- Saved chronological holdout: 32,821 rows, weeks 136–145, after training through
  week 135. Reloading the artifact and independently predicting these rows gives
  **28.23494% WAPE**, versus **34.80762%** for the previous-observation baseline.
  Both reproduce the saved rounded metrics. This reuses the original holdout;
  it is not a new independent test or evidence of kitchen-customer accuracy.
- Center 13, week 146: 51 model predictions, total **21,916.11169** portions,
  and four ingredient risks using explicitly simulated operations.
- Promotion scenario: **49,246.95416** portions with both promotion flags set.
  This is a model what-if, not established causal uplift or a delivery promise.
- Actual historical replay for center 13/week 136: 51 observations.
- A center without simulated operations returns `operational_data_unavailable`;
  no stock is invented as a fallback.

## Integration checks and fix

The real-model tests previously checked only the default source-tree artifact
path when deciding whether to skip. They now check the configured artifact path,
so an external restored bundle receives actual API coverage.

The existing Django suites `myapp.test_predictive`,
`myapp.test_predictive_backtest` and `myapp.test_predictive_security` passed:
**17 tests, zero skips**, using a disposable in-memory SQLite database and
in-memory email. Coverage includes real metrics, centers, forecast, inventory
risk, promotion and historical replay; model requests assert zero database
queries. Customer/anonymous access is denied, session POST requires CSRF,
malformed parameters are rejected, and missing source/model returns explicit
HTTP 503 responses. No real provider request or email is sent.

The numerical reproduction and archive identity are recorded in
[results.json](results.json). Recovery and API-test commands are in the
[predictive backend README](../../../backend/predictive_ai/README.md).

## Live status boundary

GitHub deployment-status requests returned HTTP Forbidden in this environment,
including the permitted escalation attempt. The current environment also lacks
a live staff session and access to the website's Vercel host. Therefore this
check establishes GitHub archive recovery and real-model local integration;
it does **not** establish the current production alias, Vercel Ready status,
deployed staff API responses or reminder delivery. No deployment configuration
or production data was changed.
