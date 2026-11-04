# Customer passkey account checks — 4 November 2026

All browser/database records here are isolated fictional fixtures. No production
DB writes, bank requests, real messages, credentials, authenticator private keys
or biometric records are included. Screenshots use native desktop Chromium,
1366×900 and 390×844 viewports, with a CTAP2 virtual authenticator and required
user verification. A test-only private key was copied **in memory** to a second
virtual authenticator to simulate a synced passkey; no key material is persisted.
This demonstrates the browser/server protocol, not physical biometric testing or
an automatic guarantee that every unrelated device has a customer's passkey.

- `manage.py test myapp`: **938 tests; 907 passed, 31 skipped**. Skips include
  PostgreSQL-only checks and optional evaluation/runtime dependencies. This full
  run preceded the final backup-eligibility check; the subsequent targeted
  PostgreSQL suite includes that check and passed.
- Targeted PostgreSQL suite: **36 tests passed**, including concurrent replay,
  origin/challenge/UV/signature/handle/counter/backup-eligibility rejection,
  customer isolation, registered checkout, QR proof policy, stock/packaging
  allocations, payment/receipt/report consistency and last-key protection.
- `npm test`, `npm run test:ux`, `npm run test:checkout`,
  `npm run test:accounts` and the production frontend build passed. The build
  retains the existing main-bundle size warning; this batch adds a lazy account
  page and no model or dashboard changes.
- Native browser flow passed: account gate before receipt/payment, same-user
  registration with retained basket, contact prefill, cash placement, passkey
  reauthentication/profile edit, immutable accepted order contact, mobile layout,
  and same-account orders on a second browser with the simulated synced key.
  A deliberately delayed storefront response also checks that an initial page
  load does not accidentally open the staff password dialog. Zero page errors.
- Final manual SQL ran twice against the `django_app` schema in ephemeral
  PostgreSQL 16. All expected columns/identity constraints/RLS were verified;
  populated private tables returned no rows to an untrusted reader. A saved
  fictional order was unchanged. The migration release check and
  `makemigrations --check --dry-run` passed.

`browser-check.py` is a reproducible acceptance script requiring the application
on localhost:8081 with `PASSKEY_ORIGIN=http://localhost:8081`, an isolated database,
one active meal with enough eligible stock, a North delivery area and dummy QR
settings. It blocks external requests. Do not point it at production or a real
bank setup. Backend crypto/security fixtures are in `myapp/test_passkeys.py`.

Publication is staged: `8cdf40c` publishes only the SQL prerequisite and release
instructions to `main`. The application commit remains local until the owner
confirms `0027_customer_passkeys` in the target database. A Git push or local
check does not establish a Ready Vercel deployment. Integration/report branches
and all model artifacts/evaluation are preserved.
