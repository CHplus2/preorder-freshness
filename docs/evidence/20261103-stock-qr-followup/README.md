# Stock and QR follow-up verification — 3 November 2026

Review baseline: main at e596cad, with the batch-1 changes in this commit.
Fixtures, receiving-image URLs and receipt images are fictional and isolated.
No personal Maybank code, customer record, secret or production database is here.

- Full SQLite backend regression: 924 discovered, 894 passed, 30 skipped.
  The skips require PostgreSQL or absent external runtime artifacts, not passes.
- Focused SQLite expiry/setup/guest/simple-ordering checks: 60 passed.
- Separate disposable PostgreSQL 16 selection: 65 passed, no skips, including
  real ingredient/packaging row locks and competing checkout/receipt-image use.
- Frontend unit/SSR, UX, checkout, guest UI, lint and build passed. The existing
  main bundle size advisory remains.
- Chromium at 1440×1000 and 390×844 verified the thirty-day calculation with a
  three-day printed cap and explicit correction, detailed chicken shortage,
  rice-only restocking not covering chicken, return/retry stock rechecks, QR-only
  scoped saving (including trimmed URL input) without saving an unrelated fee
  edit, image-load failure recovery, receipt upload and correct placement stock.
- The receiving image URL intentionally could not load; the new visible error
  was verified. Synthetic receipt pixels are not evidence of a bank transaction.
- No new migration or model change. No actual production stock, old batch code,
  delivery history, payment record, scheduler or FYP document was modified.

Live inspection was unavailable: the public deployment was blocked by this
execution environment's HTTP policy, and the configured read-only DB diagnostic
could not connect. Those failures are not evidence of a broken deployed website.
Do not claim the live CHK-1 row was inspected or a personal bank QR was installed.
See the follow-up roadmap for passkey accounts and remaining requested changes.
