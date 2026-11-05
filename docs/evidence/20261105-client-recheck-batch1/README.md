# Client recheck batch 1 — local evidence

5 November 2026, `main`. Builds on the unpushed `1247bc4` checkout/account fix.
No schema, model, production bank configuration or scheduler change. Live
storefront inspection was blocked by proxy policy; no Vercel Ready claim.

Validation:

- 106 Django tests across guest checkout, client journey, passkeys, simple
  ordering, packaging stock and client reports: OK, one skipped. Isolated SQLite,
  no production database connection. The earlier source baseline full suite was
  977 tests with 49 skips; that is separate from this focused run.
- Frontend accounts, checkout and UX suites passed with local socket permission.
  Added checks cover modal-entry landing, the staff/customer account distinction
  and explicit area-fee waiver explanation.
- Changed JS/JSX ESLint and production build passed. The existing Vite main-chunk
  advisory remains.
- Playwright/Chromium with built assets and local APIs passed 17 journey checks,
  with no uncaught page errors. Virtual WebAuthn and explicitly fictional QR,
  bank/contact/stock/receipt fixtures were used. External browser requests were
  blocked. No actual money, email or courier request was sent.

Browser checks include direct `/account` modal entry, Escape and focus return,
staff sign-in, customer registration preserving the basket, the simplified staff
account, mobile overflow, bank-only delivery, QR-only pickup, receipt upload,
unpaid order placement, passkey sign-in after logout and protected staff entry.
The previous test's final logout assertion was corrected to leave the owner on
the protected kitchen route; the account route correctly opens customer entry
after logout.

A RM12 meal plus RM10 area fee produced RM22. Enabling a RM10 free-delivery
threshold correctly produced RM12 and explained the waived RM10 fee. Turning
that promotion off restored RM22. Changing the server area fee to RM12 updated
the payment amount to RM24 without discarding the chosen 08:00 date/time. The
saved order remained unpaid, with a RM12 delivery snapshot, pending bank review.

Screenshots contain fixtures, not personal bank details or real receipts:

- [Direct-account modal](direct-account-modal.png)
- [Desktop staff account](desktop-staff-account.png)
- [Mobile staff account](mobile-staff-account.png)
- [Area-fee waiver explanation](desktop-area-fee-waiver.png)
- [Mobile QR and receipt upload](mobile-qr-bank-receipt.png)

Release/setup steps and the remaining audit batches are in the
[client recheck plan](../../client-recheck-batches-20261105.md).
