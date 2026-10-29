# Delivery pricing, categories and quantity presentation

Requested on 29 October 2026, following the completed five-batch UI review.
These are additional changes, not unfinished work from that earlier review.

## Batch sequence

1. **Delivery pricing — implemented.** Make the existing editable shop fee
   understandable, explain the difference from courier cost, and keep customer
   totals clear. Add an optional owner-entered cost comparison.
2. **Menu category management — implemented.** Owner creation, renaming and
   safe deletion controls preserve menu references, with inline validation and
   explicit recovery for uncertain requests.
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


## Batch 2: categories and Settings follow-up

Menu management now has **Manage categories** beside Create menu. The dialog
supports adding a category, renaming it, and deleting an empty category after a
confirmation. Renaming preserves category IDs and menu links. Names are trimmed,
repeated spaces are collapsed, and blank, overlong or case-insensitive duplicate
names receive validation errors. Mutations are staff-only; public reads remain
available. The existing category endpoints are used, without schema changes:

- `GET /api/categories/` and `GET /api/categories/:id/` return sorted categories.
  Staff responses include `menu_count` across active, paused and archived menus;
  public responses do not expose these management counts.
- `POST /api/categories/` creates; `PATCH /api/categories/:id/` renames.
- `DELETE /api/categories/:id/` returns 204 only for an empty category. Otherwise
  it returns 409 with `code: category_in_use`, preserving menu links. The server
  rechecks under a category row lock, rather than relying on the displayed count.
  Direct model/admin deletion retains the existing model behaviour; this guard
  applies to the website API, not a new database constraint.

The owner can move linked menus through Edit & steps before deleting a category.
After changes, category choices, menu names and filters refresh in the current
application; a removed selected category resets the menu filter. Other open
browser tabs need refresh. The dialog uses the existing native modal with focus
containment and opener restoration. Failed or uncertain requests retain the
entries; a network/server uncertainty blocks another mutation until the owner
refreshes and reviews the list. Unexpected mutation responses also require this
recovery, instead of claiming success.

An existing menu editor issue surfaced during this flow: PATCH previously
re-submitted an unchanged legacy photo path and could reject an otherwise valid
category edit. Unchanged image references are now omitted from edit payloads;
new and changed references still pass the existing server validation.

The additional Settings feedback in this batch is addressed as follows:

- Courier delivery describes the supported app-booking, saved tracking link and
  owner/bulk status workflow. The unused API setup disclosure and disconnected
  API label were removed. A tracking link is still clearly distinguished from
  automatic order-status updates; no provider integration was added.
- Service area description is a separate, explicitly labelled multiline field.
  Delivery areas explains short place names on separate lines, such as Kuala
  Lumpur and Petaling Jaya. A long sentence gets one inline error at that field,
  with focus returned there on save; the owner's entries are retained. The
  server also identifies the overlong area and suggests using the description
  field. No delivery restrictions are silently inferred from prose or changed
  on the production database. Other Settings fields now have explicit labels.
- Kitchen setup checks count only active menus accepting new orders. Paused
  and archived menus remain in records and no longer block current-menu setup.
  The checklist states this scope. Inventory follow-up and email worker
  monitoring retain their recorded-data behaviour; no expired stock or reminder
  receipts were deleted and no reminder worker was triggered.

### Batch 2 verification

Seventy backend tests passed, with three existing PostgreSQL-only tests skipped
on isolated SQLite (73 discovered). Coverage includes staff permissions, public
reads, name validation, rename/filter continuity, non-empty deletion protection
across all selling states, reassignment before deletion, active-only setup and
delivery-area validation. Frontend lint, UX and checkout suites and the production
build passed.

Local Chromium exercised the real owner create/rename/reassign/delete flow,
customer category filtering, a stale delete confirmation after a menu was added
by another editor, escape/opener focus, uncertain mutation recovery, and the
actual Settings error/fix/save flow. Fourteen WCAG A/AA and overflow checks passed
at 1440, 768, 390 and 320 pixels, including dialog control containment and 44px
minimum control heights. The phone confirmation layout was visually reviewed.
Only fictional local SQLite records were changed. No production record, payment,
email, courier booking or model was changed. Vercel deployment was not observed.
No database migration is required. Batch 3 remains FreshCast quantity formatting.


### Copy refinement

The Delivery areas field now uses the short hint “One area per line. Leave blank
to accept any area.” An overlong entry shows “Area 1: use 80 characters or fewer.”
The same concise error is returned by the server. Area limits and validation
behaviour are unchanged.
