# Checkout payment and account access checks — 5 November 2026

Source branch: `main`. No migration, production database write, real payment,
email send, courier integration or forecasting/model change. Integration/report
branches remain frozen. These local results do not establish Vercel Ready status
or the live project's Function Storage allowance.

## Automated validation

- Django full `myapp` suite: 977 tests, OK with 49 skips (928 executed without a
  skip), using isolated SQLite. The first sandboxed attempt could not bind its
  HTTP test server; the approved rerun completed successfully.
- Added backend regressions cover bank-only delivery evidence, QR-only pickup,
  changed receiving details invalidating unfinished proof, authoritative area
  pricing and free-delivery thresholds. Quotes and rejected claims do not deduct
  stock or create orders; uploaded evidence does not create a paid ledger event.
- Frontend `npm test`, `test:accounts`, `test:checkout` and `test:ux` passed.
  The staff-route rendering expectation was updated for the explicit kitchen
  sign-in action; nonstaff content remains protected.
- Changed JavaScript/JSX files pass ESLint; the production Vite build passes
  with the existing main-chunk size advisory.

## Browser journey

Chromium/Playwright used a local Django server and built frontend, fictional
stock/contact/bank records, an explicitly nonfunctional QR fixture, a generated
receipt image and a virtual WebAuthn authenticator. External requests were
blocked. The browser reported no uncaught page errors.

Checked actual interactions:

1. Header Account opens the customer modal; create/sign-in switch, Escape,
   opener focus restoration and the staff switch work without stacked dialogs.
2. Staff password login opens Orders; staff access is still reachable after
   logout. Customer passkey registration preserves the browsing basket.
3. Basket has food totals and no delivery-area form. Checkout holds the one
   area/date/time selection and defaults to the configured transfer method.
4. A RM12 meal plus North's RM10 fee produces RM22. Changing North's server fee
   to RM12 and rechecking changes the payment total to RM24 without losing the
   chosen 08:00 time/date. Receiving details wait for a matching server quote.
5. Bank-only delivery works; bank-only collection exposes no cash choice and
   blocks placement until a receiving QR is configured.
6. A private receipt upload and manual order succeed. The saved fee is RM12 and
   payment stays unpaid for kitchen review. No bank transaction was made.
7. The 390 px mobile viewport has no horizontal overflow. Customer logout and
   passkey sign-in return the same account.

Screenshots use these local fixtures and are UI evidence, not bank/payment or
production-delivery evidence:

- [Desktop payment panel](desktop-qr-bank-receipt.png)
- [Mobile payment panel](mobile-qr-bank-receipt.png)
- [Mobile sign-in modal](mobile-customer-signin.png)

## Owner setup after deployment

Settings → **QR & bank transfer**: add a receiving QR image and/or delivery bank
details, enable the option, then **Save payment settings**. Collection requires
the QR image. The application never invents the owner's receiving details.
Checkout shows receiving details and upload after the area/date/time stock check
confirms the final total. Customers can scan with another device or use their
banking app's saved-image option where supported; they verify the recipient in
the bank app and upload an image receipt. Staff verify payment separately.

Code can be edited/committed while a hosting allowance is exceeded. Publishing
to GitHub is separate from Vercel accepting a deployment. The actual quota/reset
or deployment status must be read in the project's Vercel dashboard.
