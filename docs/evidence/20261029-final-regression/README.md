# Final application regression — 29 October 2026

The application was checked at base revision `8746c3c` after the five UI review
batches and original Genpact model recovery. No production records or provider
configuration were accessed or changed.

| Check | Result |
| --- | --- |
| Full Django application suite, isolated SQLite | 797 discovered: 776 passed, 21 PostgreSQL-only tests skipped |
| PostgreSQL locking tests, temporary PostgreSQL 16 | All 21 passed: 18 account/order/reminder tests and 3 inventory tests |
| Release, backup, packaging and entrypoint tests | 34 passed |
| Frontend unit, UX, checkout and Planner suites | Passed |
| Frontend recommendation, predictive and shopping suites | Passed |
| Frontend PayPal, escrow and image suites | Passed |
| Frontend lint and production build | Passed |

All 797 discovered application tests were therefore exercised across SQLite and
PostgreSQL. This does not mean every application test was repeated on PostgreSQL.
The real-model tests used the verified original GitHub archive restored outside
the checkout, rather than being skipped for missing artifacts. See the
[model recovery evidence](../20261029-genpact-restore/README.md).

## Verification fixes

Two PostgreSQL inventory tests created processing orders without preparation
times, so the application's preparation guard rejected them before their
intended stock-locking paths. The test setup now supplies valid preparation and
delivery times. The competing-stock test additionally checks that its rejected
request actually reports insufficient stock. The assertions still require one
successful deduction, correct remaining quantities and intact audit records.
No application guard or stock-allocation implementation was relaxed.

The reusable `scripts/verify_fyp.py` command now includes all ten frontend test
suites, including recommendation, predictive, PayPal, escrow, shopping and image
checks. Its manifest explicitly notes the provisioned-model prerequisite. The
individual suites were executed for this review; the expanded orchestration
script was syntax-checked and its script names checked against `package.json`.
The full backend run was not unnecessarily repeated after this orchestration-only
change. PostgreSQL inventory tests were rerun after correcting their setup.

## Isolation and practical limits

- SQLite used an in-memory test database. PostgreSQL used a fresh, loopback-only
  container with temporary storage; it was stopped and removed afterwards.
  Production Supabase was not connected. Migrations ran only in test databases.
- Email delivery and external payment/provider calls were mocked or used local
  test transports. No actual email, cryptocurrency transfer, PayPal transaction
  or courier booking was made. These results do not prove live inbox receipt,
  scheduler cadence, live payment webhooks or courier synchronization.
- This run checks functional regressions and explicit concurrency behaviour. It
  is not a load benchmark, new browser walkthrough, customer study or guarantee
  that every possible bug has been found. Browser/accessibility evidence from
  the UI batches remains documented in the
  [UI review](../../UI-UX-REVIEW-2026-10-28.md).
- Live Vercel deployment status remains unverified because of the environment's
  access restrictions. No new production migration or model training is needed
  for these test and verification-tool changes.
