# Checkout follow-up — 5 November 2026

These are real Chromium screenshots of the changed local application at a
390 × 844 viewport. The kitchen, receiving picture, receipt and orders are local
fixtures in an explicitly selected temporary SQLite database. The receiving
picture says “NO REAL PAYMENT”; no banking app, real payment, customer record,
production database, SMTP send or live Vercel deployment was involved.

- [Receipt uploaded](mobile-receipt-ready.png): generic receiving QR, automatic
  receipt selection/upload, private link and owner-review explanation.
- [Preorder ready to submit](mobile-submit-ready.png): successfully uploaded
  evidence enables Place preorder; payment verification remains separate.
- [Browser results](browser-results.json): nine completed journey checks, zero
  uncaught browser errors, exactly one upload after a file selected during a
  focus-triggered availability recheck. The check also covered failed-upload
  retry, time-change proof invalidation, duplicate order-request retry, saved
  staff names, late profile reads and local/international phone formats.

Verification: `myapp.test_guest_checkout` and `myapp.test_passkeys`: 40 tests,
39 passed and one SQLite concurrency skip. Frontend `npm test`, `test:checkout`,
`test:accounts`, `test:guest`, `test:ux`, changed-component ESLint and production
build passed. The build retains the existing large-main-chunk advisory.

No new migration is required. `duitnow_qr_url` remains the compatibility field
for a receiving bank QR. Passkey authentication and the account requirement have
not been removed. A name/phone contact is not a verified telephone identity or a
replacement for a credential.
