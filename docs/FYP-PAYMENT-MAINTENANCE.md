# Payment and CI maintenance — 11 October 2026

Work stays on `integration/dormathon-demo`; no main merge, schema change, model retraining or production data change is required.

## Failures corrected

- The reported escrow assertion checked transaction submission rather than final execution. Tests now accept only contract `CALL_EXCEPTION` failures, await mined receipts, disable the in-memory provider cache, and explicitly exercise duplicate funding and double withdrawal with mined reverting transactions. Contract permissions were not relaxed.
- Ganache 7 has no native µWS transport binary for Node 24. The test process selects its documented JavaScript fallback and retains an informational performance notice.
- A clean Python environment with only `requirements.txt` reproduced `ModuleNotFoundError: numpy` when importing the backtest tests. CI now installs the existing ML lock too, and runs escrow independently of the Django job. Predictive and product UX regression tests are included in CI.
- A subsequent clean repository export reproduced a missing-model test that accidentally depended on cloud-only source CSVs. That test now supplies its own minimal source fixtures, so missing source and missing model errors are verified independently; the application's missing-file behavior was preserved.

## UI and recovery

Escrow uses readable sections, a concise test-network notice, collapsible setup/limitations, current-wallet roles, chain-time deadline eligibility, copyable demo IDs, pending-operation locking and actionable errors. Changing wallets clears stale roles and balances. Confirmed transactions whose follow-up read fails tell users to refresh rather than repeat the payment. The contract remains authoritative even when UI state is stale.

The demo-credit page uses the site's light palette, labelled inputs, visible focus states and responsive spacing. Wallet outages offer retry instead of incorrectly offering wallet creation. Failed top-ups retain both the entered amount and existing wallet; a pending top-up disables repeat clicks. Basket loading, failure and empty states prevent misleading payment actions. Unsupported payment routes offer a return to checkout.

## Verified locally

- Escrow: four contract tests passed, including lifecycle, authorization, missed deadlines, double withdrawal, funding bounds, seller refunds, arbitrated release and mainnet rejection.
- Django: 251 tests executed; 249 passed and two PostgreSQL-only concurrency tests were skipped in isolated SQLite. The suite also passed in a fresh environment installed from the corrected CI dependencies. Provisioned real-model checks executed locally.
- The complete suite also passed from a clean repository export without ignored CSVs/model files: 247 passed and four skipped (two PostgreSQL concurrency tests and two explicitly artifact-dependent live-model tests). This reproduces the GitHub CI checkout rather than relying on cloud provisioning.
- Release/provisioning/entrypoint tests: 21 passed after the frontend build completed.
- Standard frontend tests, 33 predictive tests, four escrow UI state/transaction tests, existing product UX checks and the production frontend build passed. ESLint passed for changed JavaScript/JSX source files.
- Chromium exercised funding, dispatch, receipt, withdrawal, wallet switching and a deadline-triggered refund against the real compiled contract on an in-memory Ganache chain using Sepolia's chain ID. No public-chain transaction was sent. Desktop/mobile rendering passed without page errors or mobile horizontal overflow.
- Chromium exercised wallet-load outage/retry, failed top-up retention, duplicate-click protection and a successful retry against the isolated local Django database. Unsupported payment and missing-extension recovery also passed.

## Remaining distinctions

`/escrow-demo` is a separate unaudited testnet lab, not a verified payment method for store orders. It still requires deploying the supplied contract on Sepolia and using test wallets. Actual Sepolia extension interactions were not verified in the cloud browser; the local browser bridge forwarded wallet RPCs to the real in-memory EVM.

The existing Vercel Preview failure was independently inspected: its build lacks a PostgreSQL `DATABASE_URL`. Production and Preview have separate environment settings. The working Production deployment does not resolve that missing Preview configuration. Production database credentials have not been copied into Preview, and no deployment guard or failed check was disabled to conceal the failure. Supabase's skipped Preview check is distinct from a failed application test.
