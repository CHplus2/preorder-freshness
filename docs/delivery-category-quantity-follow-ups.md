# Delivery pricing, categories and quantity presentation

Requested on 29 October 2026, following the completed five-batch UI review.
These are additional changes, not unfinished work from that earlier review.

## Batch sequence

1. **Delivery pricing — implemented.** Make the existing editable shop fee
   understandable, explain the difference from courier cost, and keep customer
   totals clear. Add an optional owner-entered cost comparison.
2. **Menu category management — next.** Review the category API and implement
   appropriate owner creation, renaming and safe deletion controls. Preserve
   menu references and provide clear inline validation and recovery.
3. **FreshCast quantity formatting — pending.** Review two-decimal kilogram
   summaries while preserving precise ingredient amounts in calculations and
   detailed evidence. Avoid hiding small positive quantities through rounding.

## Batch 1 behaviour

- Settings has a Delivery pricing shortcut to the existing fee field, now
  labelled Flat delivery fee per order (RM). This is a configurable shop fee,
  not an automatically calculated historical average or a live GrabExpress quote.
- It applies to supported delivery areas and express requests. The optional
  free-delivery threshold uses food subtotal before discounts; blank means the
  configured fee is charged and zero makes all delivery orders free. Pickup
  remains free. No area-specific tariff or courier integration was added.
- The owner arranges and pays the courier. If actual courier cost exceeds the
  customer fee, that difference is a kitchen cost. The optional Check a courier
  cost example compares entered amounts using cents, covers free delivery and
  distinguishes a remainder from net profit. It is not stored, sent to a provider
  or used in customer pricing, and an invalid optional example does not prevent
  saving valid store settings.
- Basket and checkout label the delivery fee and explain that it is included in
  the total. Express wording no longer suggests an unspecified extra charge.
  The application does not add a second charge for a later courier quote.
- Existing order fees stay saved when settings change. No per-order fee editor,
  extra-payment demand or new charge mechanism was introduced. New orders use
  the current configured fee and are subject to existing checkout rechecks.

## Verification

Frontend lint, checkout and UX suites and production build passed. Sixty-three
backend fulfilment, rescheduling and PayPal tests passed. The new paid-order
regression verifies that changing the fee does not alter an accepted fee or
debit its wallet again, while a subsequent order receives the new fee.

Local Chromium checks the pricing shortcut/focus, exact cost differences,
free-delivery cases, invalid optional input, actual local settings save, omission
of the example quote from the settings payload, and buyer basket/checkout totals.
Twelve full-page WCAG A/AA and overflow checks passed across Settings, basket and
checkout at 1440, 768, 390 and 320 pixels. The phone layout was visually reviewed.

Only fictional local SQLite records were used. No production setting, fee,
customer order, payment, email, courier booking or forecast was changed. No new
database migration is required. This is not live Vercel or courier verification.

## Pickup and layout correction before batch 2

- The collection/delivery settings title is now an ordinary heading inside its
  bordered section, with a separate invisible fieldset legend for accessibility.
  Disabled-field behaviour is preserved.
- Pickup location, instructions and hours remain visible while pickup is off.
  The explicit status explains that a saved location alone does not enable the
  option. The owner must switch on Offer self-collection and save. Location is
  required only when pickup is enabled; a location does not silently opt the
  business into offering collection.
- Basket time choices allow text wrapping, prevent intrinsic-width grid growth
  and use wider responsive columns. Nine hour-range choices and the fallback
  help link stay within the availability card. No clipping or hidden overflow
  is used to conceal labels.

Frontend lint, checkout and UX checks and the production build passed. Fourteen
local browser WCAG A/AA and page-overflow checks passed. Additional rectangle
checks verify the Settings heading, every time button and fallback help text
inside their respective cards at 1440, 1060, 768, 650, 390 and 320 pixels. This
extends the earlier page-wide overflow checks to the actual component bounds.

The long nine-window response is an explicit UI fixture matching the reported
labels. Separately, real isolated backend calls verify the full pickup setup:
saved location with pickup off hides the customer choice; enabling it through
the Settings UI and saving exposes it after customer refresh; real collection
slots can be selected and carried to checkout with no address or delivery fee.
No production setting or record was changed, and no order/payment was submitted.
Category CRUD and FreshCast precision remain the next requested batches.
