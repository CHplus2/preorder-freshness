# Inventory review batch 1 validation — 4 November 2026

All screenshots and exercised records are isolated fictional fixtures. No bank
request, live customer message, production stock receipt or live batch rename
was performed. The configured production read was unavailable.

- Full backend suite: **944 tests, 913 passed, 31 skipped**. The initial run
  omitted loopback hosts from the test environment and failed two host checks;
  the corrected full run with testserver/localhost/127.0.0.1 passed. Host/CSRF
  protections remain enabled.
- Targeted inventory/order suite: 60 passed. Coverage includes generated codes,
  former-code audit, stable quantities/holds/deadlines, stale-edit and collision
  rejection, customer write denial, aggregated shortages and order deduction.
- Frontend `npm test`, `test:ux`, `test:checkout` and production build passed.
  A stale assertion left from the passkey release was corrected to check saved
  account details rather than the replaced guest-checkout introductory sentence.
- Native Chromium, 1366×1000 and 390×844: two simultaneous shortages displayed,
  one stock-recheck button, no horizontal overflow, owner receipts generate
  references, receiving the missing stock clears the same basket's warning,
  and placing the order deducts it. No page errors. Held/expired lots remain
  excluded. External requests were blocked during these tests.
- PostgreSQL 16, isolated django_app schema: correction changes two short codes,
  logs their prior references, does nothing on a second run, skips a deliberate
  conflict and preserves quantities/dates/holds/material IDs. Read-only audit
  calculates expected ingredient and packaging needs and flags a missing recipe.
- No schema changes: Django system check and migration-drift check passed.

The existing frontend main-bundle warning remains. No predictive model, artifact,
forecast/evaluation result, historical payment, frozen FYP branch or document was
changed. A published SQL file is not an executed production database change.
