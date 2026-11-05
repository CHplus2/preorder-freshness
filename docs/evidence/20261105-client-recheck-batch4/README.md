# Batch 4 — delivery, handover and final workflow review

5 November 2026, `main`, following `d009682`. No schema migration, forecasting
model, production database/configuration or scheduler change. All browser stock,
accounts, QR/receipt images and payment records are isolated fixtures. No real
money, email, WhatsApp message or courier booking was sent. Production deployment
and actual SMTP/scheduler operation are not established by these local checks.

## Changes

- Fixed the delivery section's save scope: availability and minute hours now
  save with its areas/fees. The action remains available when delivery is off.
  Unrelated storefront/bank drafts are preserved, not published by that save.
- Pickup save feedback and a clear receiving-QR setup link when needed.
- A clear closed-checkout state when both delivery and collection are off.
- Manual call/WhatsApp drafts for open simple orders using accepted phone/name;
  the full address no longer produces false missing-city/postcode warnings.
- No unnecessary legacy-wallet request in simple mode. Website build version
  appears under Settings → Advanced to help identify the deployed release.

## Automated validation

Full Django `myapp` suite: **979 tests, OK, 49 skipped**. SQLite was isolated;
PostgreSQL-only locks remain among the skips. No new real-PostgreSQL concurrency
or production data claims are made. Reminder tests mock SMTP and verify delivery/
collection labels, suppression of preparation reminders, once-per-agreed-time
receipts, changed-time handling, closed-order exclusion, bounded failed-send
retries, staff-only read-only status and authenticated worker access. They do not
prove that an automatic schedule is enabled or an inbox received mail.

Frontend default, guest, checkout, UX and account suites passed. Added coverage
checks the full delivery payload, exclusion of unrelated drafts, invalid hours,
disabling despite hidden invalid drafts, closed checkout and manual WhatsApp/
recipient fallback rules. Changed-file ESLint and production build passed; the
existing main-chunk advisory remains.

## Browser journey

Chromium, built assets, local APIs and a virtual WebAuthn authenticator passed
**20 journey checks**, with no uncaught page errors:

1. Simple-mode Planner URL redirects to Orders; cooking controls are absent.
2. Save 07:45–10:45 delivery hours, reload and verify persistence. Unsaved kitchen
   name/bank instructions stay unpublished. Reversed hours are rejected. Restore
   the client's 07:30–11:00 range.
3. Turn delivery and pickup off: save is accessible, checkout shows closed and
   retains the basket. Enable pickup with its location: it appears at checkout
   with QR only, no delivery-area/address/cash fields, and no delivery fee.
4. Restore delivery; 07:29 is rejected, 07:30 succeeds. QR/bank and cash choices
   appear. Upload a private image receipt and place an unpaid QR order.
5. Replay checkout: one order, one 100 g deduction and one meal-box deduction.
   Stock changes from 10,000 g / 20 boxes to **9,900 g / 19 boxes**.
6. Owner opens contact details: Call buyer and a WhatsApp draft use the accepted
   number. The draft is inspected, not sent. A blocked clipboard provides a
   selectable message. Courier handover uses the entered full address without
   invented missing city/postcode fields.
7. Increase North's future fee from RM10 to RM15. The accepted order retains its
   RM10 fee and remains unpaid. Staff review the private proof, record separate
   payment verification and mark actual receipt through the bulk action. The
   customer sees Received; stock remains 9,900 g / 19 boxes.
8. Reminder status is read only, explains the delivery-only workflow and cannot
   send a test with the local unconfigured transport. No legacy-wallet HTTP call
   occurs throughout the simple-mode journey. Mobile screens have no horizontal
   overflow.

A separate read-only visual pass checked the version label and captured standard
1366 × 1000 settings/reminder viewports. A long element screenshot was replaced
because its sticky-header capture obscured fields. Mobile pages use 390 × 844;
the contact image is a section capture. Local pre-commit builds display the base
revision `d009682`; a Vercel build of the published commit displays its own SHA.

- [Delivery settings](desktop-delivery-settings.png)
- [Reminder status](desktop-reminder-status.png)
- [Website version location](desktop-website-version.png)
- [Pickup checkout](mobile-pickup-checkout.png)
- [Manual customer contact](mobile-buyer-contact.png)

All four source-review batches are complete. Live release/configuration checks
are listed in the [review plan](../../client-recheck-batches-20261105.md).
