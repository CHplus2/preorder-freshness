# Client follow-up batches — 3 November 2026

These are additional requests after the original five client-feedback batches.
Work and pushes remain on `main` only. Integration and the report branch stay
frozen. Do not treat an implemented source change as a verified live deployment.

## Decisions confirmed in this conversation

- Customers need an account usable on another device. The existing browser-only
  guest flow does not fulfil that requirement. The chosen passwordless method
  is **passkeys** (fingerprint, face or device PIN), with no SMS provider.
  Name/phone are profile/contact details, not sufficient proof to sign in.
- The selected delivery area determines the **fee**. Different delivery days per
  area were not requested. Existing per-area fees and the common configured hours
  remain authoritative. Area names describe service coverage, not full addresses.
- Historical data needs review for missing dates, obsolete payment actions and
  placeholder batch references. Renaming an explicitly fictional sample is
  different from changing evidence of a real past payment or handover.

| Follow-up batch | Scope | Status |
| --- | --- | --- |
| 1 | Explain/correct shelf-life date limits; make stock rechecks and ingredient shortages clear; expose receiving-QR setup and area-fee controls | Implemented and tested; source publication and live deployment are separate |
| 2 | Passkey account registration/login, named customer profile and checkout prefill, account recovery/cross-device limits | Implemented/tested; owner confirmed running migration 0027 on 4 November; source published as `4be9c09`; owner confirmation recorded as `6dea316` |
| 3 | Delivery-due owner email reminders for the current workflow, without preparation reminders or duplicate schedules | Implemented/tested 4 November; same worker/schedule, no live email or scheduler changes claimed |
| 4 | Operational daily summary entry under Orders, retained sales reporting/print preview, and reviewed cleanup of explicitly fictional historical records/references | Planned; no historical delivery/payment/stock records changed by batch 1 |

## Batch 1 findings and changes

**Expiry:** 3 November 2026 + 30 days is **3 December 2026**. A saved printed
expiry, an opened-date limit or a thawed-date limit can produce an earlier stock
deadline. The calculation is intentionally the earliest applicable limit. The
live `CHK-1` row was not readable from this environment, so this review does not
claim which private field caused that particular row's 6 November deadline.

The form now shows the base calculation, the exact controlling date and why it
wins. A retained printed date is visible outside the collapsed handling section.
An explicit **Remove incorrectly recorded printed date** action corrects an
unlabelled batch's mistaken entry in the draft; saving still validates all dates.
It does not remove actual opened/thawed limits or holds. Inventory rows link to
the explanation when an earlier limit caps their calculation or the saved
deadline differs from the calculated values. No existing batches were extended
automatically.

**Stock:** adding rice cannot cover Chicken boneless trimmed. Recipes refer to
specific raw-material identities; a similarly named material is not silently
substituted. Ingredient-shortage errors now show the required and eligible
quantity for the named ingredient. Quote and simple-mode placement share the
same precheck; final deduction still rechecks under locks and rolls back on a
shortage. Menu recommendations use the same dated-stock checks.

An actual refresh defect was found: a quote showing a stock shortage could remain
unchanged after inventory was updated in another tab. Quotes now recheck on
return/focus, and ingredient-stock errors offer a retry without changing the
chosen date. Inventory saves also emit a local invalidation event. A quote is
advisory and does not reserve stock or mark payment.

**QR setup:** the enable switch now sits beside the receiving-image upload in
**Settings → Receiving QR payment**. **Save QR payment settings** saves only
the image, instructions and switch, preserving unrelated unsaved area-price
edits. Setup checks report the saved QR status as missing image, off or enabled.
The customer form explains that choosing **DuitNow QR** displays the receiving
code and upload control. An image-load failure now has a visible explanation
instead of silently hiding the image. No personal Maybank QR was invented,
published from source, or claimed to be installed in the live database.

**Area fees:** the shortcut is labelled **Delivery areas & fees**. Existing
Settings → Collection & delivery supports short area names, individual prices
and a default fee. Kuala Lumpur/Klang can represent whole-city coverage; smaller
neighbourhoods are appropriate when the kitchen covers only part of a city.
The customer still supplies a full address separately.

## Verification

See `docs/evidence/20261103-stock-qr-followup/`. All fixtures were isolated and
fictional, including receipt images. Browser checks cover the 30-day/3-day cap,
explicit correction, rice-versus-chicken shortage, same-date recheck, scoped QR
saving, receipt upload and actual multi-ingredient deduction at placement.

Verification: 924 backend tests discovered, **894 passed and 30 skipped**;
**65 PostgreSQL checks passed** separately with no skips; **60 focused SQLite
checks passed**; frontend unit/SSR, UX, checkout, guest UI, lint and build passed.
The existing bundle-size advisory remains. Browser walkthroughs at desktop/mobile
passed, with all data and receiving-image/receipt fixtures explicitly fictional.

No schema migration, production database writes, real bank transfers, courier
booking, live email or model changes were performed. Public-site inspection was
blocked by the environment's network policy, and the configured database read
was unavailable. The live release and saved bank settings have not been verified.

## Guidance for the remaining batches

- Preserve staff authentication. Passkeys authenticate the customer; merely
  knowing someone's name/phone must never expose their orders. Existing order
  recipient snapshots must remain historical facts after a profile edit.
- Keep one reminder scheduler. New account contact preferences must be decided
  independently of the existing owner email worker; a phone number is not an
  automatic email/WhatsApp/SMS subscription.
- A daily menu/packing summary is primarily operational, so provide its main
  entry under Orders. Keep paid/received financial reporting under Sales. The
  print preview lets the owner check name/address/phone before choosing Print /
  Save PDF and avoids printing the entire application page.
- Do not fabricate missing historical delivery dates or silently move real
  past handovers into today's 07:30–11:00 window. Explicitly fictional sample
  records can have a reviewed/audited current-workflow replacement or correction.
  Preserve original payment provenance; a PayPal Sandbox receipt must not become
  a claimed QR bank transfer. Old payment controls can be made historical/read-only
  rather than advertised as current checkout choices.
- Placeholder sample batch references can be replaced with ordinary batch codes
  through an audited, collision-checked mapping. Preserve quantity/date/hold
  evidence and the original reference in traceability history. Renaming a sample
  must not turn it into purported physical stock.

## Batch 2 — customer accounts (4 November 2026)

The owner confirmed that an account is required before ordering. Customers may
browse and build a basket, then create a passkey account with name/phone or sign
in with their saved passkey. Registering upgrades the current user, preserving
their basket/history. Signing into an existing account loads its own basket;
unrelated guest histories are never merged by matching a phone number.

The customer profile, checkout prefill, backup-key list, add/remove and verified
contact edits are implemented. Contact changes leave accepted order snapshots
unchanged. Staff access remains separate. The stable router survives account
transitions while private providers remount, preventing stale-account reads.
Registered simple customers do not request legacy wallet/email settings.

Registration/sign-in use the native browser WebAuthn API, required device user
verification and the pinned Python verification library. Challenges expire,
remain session/action bound and are consumed once. Server-side account gates
protect order placement and receipt upload, independent of the UI. Removal is
owner-only, needs recent verification and cannot delete the last key. Revocation
invalidates API sessions that used that credential. No biometrics/private keys
are stored by the website. Synced/backup keys are needed for other devices and
recovery; there is no insecure name/phone-only recovery.

Deployment has a prerequisite: run the complete published
`deploy/sql/0027_customer_passkeys.sql` in the private Supabase SQL Editor. The
matching app source was published on main after the owner confirmed the result;
the read-only build migration check was not bypassed. See `passkey-release.md`.
No production database, real bank payment, live email scheduler, frozen FYP
source/report branch, model or model evaluation is changed by this batch.

Validation evidence for batch 2: `docs/evidence/20261104-passkey-accounts/`.
The full backend suite passed 938 tests (31 skipped); the subsequent 36-test
PostgreSQL suite includes the final credential backup-eligibility check and
concurrent replay. The final browser flow also deliberately delays storefront
loading to check the staff-dialog race is fixed. SQL prerequisite source was
published on main as `8cdf40c`; matching application publication is pending the
target database's `0027_customer_passkeys` result.

### Release prerequisite confirmation — 4 November 2026

The owner reported running the published SQL script. Application source commit
`4be9c09` is now authorized for publication to `main`. No new implementation,
model work, email sends or database writes accompany this release step. The
existing build migration check remains enabled. The coding environment has not
independently observed the production migration record or a Ready deployment.


## Account, area-fee and morning-time review — 4 November 2026

This follow-up does not mark planned batches 3–4 above complete.
Customer profiles use name/phone; native passkeys verify sign-in, without customer
email/password/SMS. Django's staff login remains username/email plus password.
Public customer sign-in now opens `/account`; the staff dialog explains its role
and links to customer passkey access. It is unsafe to grant access from name and
phone alone. No new authentication scheme or database migration was added here.

**Settings → Collection & delivery → Delivery areas & fees** now provides local
add/edit/remove controls, individual fee entry and a dedicated partial-save
button. It preserves unrelated unsaved settings. The default-fee fallback,
free-delivery subtotal switch, empty-list unrestricted behaviour and historical
order fee preservation are explicit. Areas should be non-overlapping zones
covered by one price; broad city names are appropriate only for whole-city
coverage. The system does not verify an address against a map or postcode.

**AM/PM defect:** shared persisted delivery state correctly rejects past times,
but binding the time input directly to it erased an invalid morning draft with
no explanation. The checkout picker now keeps its local draft, publishes only
valid future selections, explains elapsed times and configured hours, and starts
on tomorrow when today's window has ended. The draft resets on basket/service
scope changes. It does not relax stock, date, account or payment validation.
See `docs/evidence/20261104-accounts-areas-time/README.md` for checks.


## Batch 3 — delivery-only kitchen reminders (4 November 2026)

The current kitchen mode suppresses preparation reminders even on older orders
that retain preparation fields. Delivery and collection use a shared eligible
queue for preview, staff status and sending. Simple orders have dated owner
receipts; old receipts prevent upgrade replay, with a later audited time change
allowing a new reminder. Existing scheduled-mode compatibility is preserved.

Settings shows owner handovers waiting and explains phone coordination. New
passkey customer accounts have no email; older explicit email subscriptions
remain separate under history. No automatic SMS/WhatsApp was added. Reading
status and command preview do not send. The shared bearer endpoint, three-email
budget, retries, closed-order exclusions and order locking remain.

No migration, new scheduler or environment changes are needed. Source has only
one reminder schedule. Live GitHub Actions history could not be read through
this environment's restricted API access, and no production worker was invoked.
See `docs/evidence/20261104-delivery-only-reminders/README.md`. Batch 4 remains
planned: Orders daily-summary entry and reviewed historical record handling.
