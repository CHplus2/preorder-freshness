# FYP cleanup — batch 2: retire unused escrow

8 November 2026, `main`, starting from `81c22b3`. Only the retired escrow feature and its direct dependencies are removed in this batch. No branches, database tables, migration files, forecasting implementations, model backups, report/poster/presentation downloads or client photos are removed.

## Resulting behaviour

- Checkout and deferred-payment selection no longer offer or accept escrow. Both scheduled delivery and collection reject a forged `payment=escrow` request without creating an order.
- `/escrow-demo` and `/payment/escrow` use the application's existing Page not found screen. Their registered React routes, lazy imports and action links are gone.
- `/api/payments/escrow/config/` and `/api/orders/<id>/escrow/` return 404. No escrow configuration poll or RPC client remains in the active application.
- Escrow-only pages, hooks, utilities, contract manifest, Solidity/Hardhat directory, management commands and obsolete escrow-only tests are removed. `ethers` and its unneeded dependency subtree are removed from the frontend package/lockfile. Other payment methods are unchanged.
- CI and the local verification runner no longer invoke deleted escrow tests. Vercel no longer includes the deleted contract manifest. Runtime tests still verify frontend serving and preserved model inputs.

## History and AI preservation

Existing accepted item names/prices, order payment instructions and `PaymentEvent` rows remain intact. Historical escrow labels and report exclusions remain so test funds do not become real client revenue. Manual receipt/refund actions on old escrow orders stay blocked. A small `legacy_payments.py` guard preserves fixed invoice delivery deadlines/windows without retaining a blockchain client or external payment calls. No schema migration is required.

The full previous escrow implementation is available in Git at [the pre-cleanup revision](https://github.com/CHplus2/preorder-freshness/tree/81c22b3/escrow). Historical escrow documents are retained with a clear retirement notice. This does not overwrite old evidence or require a temporary backup branch.

`backend/predictive_ai/`, `backend/myapp/services/kitchen_forecast.py`, predictive frontend features and the trained-model GitHub Release are preserved. The integration branch is untouched. The model archive verified in batch 1 was not modified, retrained or copied into the source tree. No current live Vercel model-readiness claim is made.

## Validation

Tests use isolated SQLite and in-memory email with dotenv loading disabled; no production database, real payment or chain transaction was used.

- The backend run executed 1,036 tests, with 76 environment-dependent skips. Its only error was an HTTP test blocked from opening a sandboxed local port. That one test passed separately with local-port access (one test, no skip). Together these checks covered 961 passes and 76 skips; this was not one uninterrupted successful suite run.
- The 40 focused backend checks cover retired APIs, rejection of new escrow orders, preserved item/payment snapshots, deferred selection, legacy payment restrictions and arrival windows.
- All 15 remaining frontend test scripts passed. The additional unknown/retired payment-route checks, ESLint and production build passed after the generic-route fallback correction. The existing large-chunk build warning remains.
- All 37 runtime/provisioning checks passed after the final build. Schema checking reported no model changes.
- Chromium at 1366 × 768 and 390 × 844 verified checkout, no phone-width overflow, recovery screens for both retired page URLs, no page errors and no escrow API calls. The browser used a temporary local customer session; it did not test production sign-in or payment providers.
- All 123 tracked forecasting/model/migration files selected for preservation compare byte-for-byte with the pre-cleanup revision. The local integration tip remains `693e1edb8bad741c91b78b2687674b1a91e2a870`. The previously downloaded original model archive retains its verified checksum.
- Changed-source secret scanning found no leaks. Source publication is separate from confirming a successful live Vercel deployment.

Backend test counts are lower than before retirement because obsolete escrow-only tests were removed and focused retirement/history checks were added. This is not a new model evaluation or a user survey result.
