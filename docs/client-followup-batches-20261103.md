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
| 2 | Passkey account registration/login, named customer profile and checkout prefill, account recovery/cross-device limits | Planned; passkeys selected by the owner, not yet implemented |
| 3 | Delivery-due owner email reminders for the current workflow, without preparation reminders or duplicate schedules | Planned; no live scheduler or email changed by batch 1 |
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
