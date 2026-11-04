# Customer accounts, area fees and morning checkout — 4 November 2026

Branch: `main`, based on `7143b19`. This evidence concerns the accompanying
source change, not a verified Vercel deployment or client acceptance.

## Changes

- Required passkey customer accounts remain implemented. Customer sign-in opens
  `/account`; protected staff password sign-in explains that it is staff access.
  Name/phone are contact details, not an authentication secret. No SMS is added.
- Area editor adds/edits/removes named zones and fees, saves its four fields
  independently, and explains default fees and free-delivery thresholds.
- Simple checkout retains an invalid local time draft rather than erasing it
  when persisted checkout state rejects it. Past and out-of-hours times have
  inline messages and cannot authorize payment/placement. Tomorrow is the initial
  date when today's window has closed. Device time is interpreted in Malaysia.
- Checkout reads current account details directly instead of copying them in a
  cascading state effect. Basket/service changes reset the time draft.

## Verification

- Django `myapp`: **957 discovered; 914 passed, 43 skipped**, SQLite, no failures.
  PostgreSQL-only suites were skipped here; this UI change adds no schema or
  transactional allocation changes. No new PostgreSQL run is claimed.
- Focused guest/account backend suites: 34 discovered; 33 passed, 1 skipped.
  Existing 07:29/07:30/11:00/11:01 boundary tests passed. New area CRUD integration
  verifies staff-only settings, renamed/deleted zones rejected, server fee
  despite a client-supplied zero, historical fee unchanged, and free-threshold
  override. Recipe/packaging stock is present in the isolated fixture.
- Frontend main unit/SSR, UX, checkout, accounts, guest tests and production build
  passed. Added helper checks cover AM/PM boundaries, Malaysia dates/past times,
  next-day default, area rename/remove/default/duplicates/invalid fees and
  prototype-safe names. ESLint passed on changed production JS/JSX files.
- Chromium walkthrough against the built app and isolated Django SQLite database:
  owner add/edit/remove/save and API readback; native virtual WebAuthn customer
  registration; past morning remains visible with error and blocked placement;
  future 07:30 retained with accepted server stock quote; 19:30 retained with
  hours explanation; correcting to 08:00 accepted; desktop/mobile no overflow;
  no uncaught browser errors.

The browser clock was fixed to 3pm Malaysia for the elapsed-morning case.
All customer, stock, address and area data are local test fixtures. The virtual
passkey is test-only; no key material was exported. No live bank transfer, email,
courier booking, or production database writes occurred.

The screenshots are **component captures**, including a tall area editor. For
those captures only, fixed navigation/toast overlays were hidden through the
screenshot API so they do not cover the component. They are not full browser
viewport screenshots or live kitchen records.

## Limits / follow-up

- The existing production build warns that a main bundle exceeds 500kB. No new
  model/forecast evaluation or broad bundle restructuring is claimed.
- Saved delivery areas are customer-selected price zones, not address verification.
  Existing free-delivery thresholds can waive their fees.
- No new migration is required; account migration 0027 was already owner-confirmed.
- Delivery-only owner reminders and an Orders entry for the daily operational
  summary remain planned follow-up batches. Existing financial reports and print
  previews remain. Historical payment/date records were not fabricated/rewritten.
- Main publication does not establish Vercel Ready or verify actual owner prices,
  stock, QR settings or scheduler operation.
