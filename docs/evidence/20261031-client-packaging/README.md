# Packaging stock verification — 31 October 2026

See `results.json`, the test logs and migration/browser results for actual scope.
The four screenshots show the running local application with isolated sample
records; they are not production stock or customer evidence. No production
services, email or payment providers were called. PostgreSQL locking checks use
a disposable local PostgreSQL 16 container; SQLite alone does not verify locks.

The full SQLite and selected PostgreSQL runs overlap; their counts must not be
added together as unique test cases. The frontend build retains the existing
main-bundle size advisory. Packaging is a separately lazy-loaded page.

Batch 1 covers packaging. Ingredient deduction at placement and the remaining
client requests are explicitly pending in `docs/client-feedback-batches.md`.
