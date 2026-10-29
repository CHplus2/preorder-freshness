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

## Pickup discovery and one checkout time step

- Pickup setup now precedes delivery pricing in Collection & delivery. A direct
  Settings shortcut focuses Offer self-collection. Location alone still does not
  opt the business into collection; the owner must enable it and save successfully.
- Storefront options refresh on returning to a visible browser tab, on entering
  the basket/checkout and through an explicit Refresh delivery & pickup options
  control. Focus/visibility events are debounced and obsolete reads are aborted.
  This fixes an already-mounted basket retaining old pickup availability after
  Settings was saved elsewhere. The current basket method falls back when its
  saved option is no longer offered.
- The basket reviews food and lets customers choose delivery or pickup to see
  the appropriate fee. It no longer contains a date/time picker, delivery-area
  field or express-request checkbox. Required area, address, time and payment
  details are completed and validated at checkout. No basket slot search is sent.
  A previously chosen valid checkout time remains stored when reviewing the
  basket and returning; it need not be entered a second time. Basket quantity,
  method and kitchen-rule changes still invalidate incompatible choices.

Frontend lint, UX/checkout suites and build passed. Isolated Chromium checks
cover the actual owner toggle/save, pickup appearing in the same open buyer
basket after a focus refresh, free collection/no address, one checkout picker,
real collection slots, retained checkout time on back/forward navigation and
fallback after pickup is disabled. Twelve WCAG A/AA and overflow audits cover
basket, Settings and checkout at 1440, 768, 390 and 320 pixels. No production
setting, booking, order, payment or email was changed; no migration is needed.
The build reports the bundle-size advisory after common chunks were regrouped;
this is a successful build, not a deployment verification.

## Additional UI batches requested after this fix

The previously requested FreshCast quantity-formatting batch is still pending.
The subsequent UI review queue is:

1. Checkout hierarchy and typography, including duplicated Contact & handover
   headings and optional-field complexity. Keep the basket a clear review step
   and validate required details at checkout.
2. Owner Settings language and technical disclosure: review email-reminder
   status, recipient/sender labels and diagnostics. Keep operational facts clear
   and move implementation details out of the normal setup flow where appropriate.
   Check related pages for the same presentation issues.
3. Notification behaviour: inspect existing timers, auto-dismiss routine success
   notices, retain appropriate recovery/action notices and verify accessibility.

## Dedicated pickup action and checkout typography

This supersedes the earlier checkbox instructions. Settings → Pickup setup now
has an explicit **Enable pickup** action. It saves the address, instructions,
collection hours and `pickup_enabled: true` in one staff-authenticated PATCH.
An enabled kitchen instead sees **Save pickup settings** and **Turn pickup off**.
Disabling submits only `pickup_enabled: false`. No subsequent global Save is
required. The availability status reflects the successful server response,
rather than continuing to describe an unsaved checkbox choice.

The pickup action does not submit unrelated delivery areas, prices or identity
fields. Unfinished edits to those sections therefore cannot block pickup setup
or accidentally become saved through this button. Missing address and invalid
collection-hour errors stay in the pickup section; a failed request does not
claim the option was enabled. The public basket/checkout still displays pickup
only when the saved option is enabled with a nonblank address. This is an owner
UI action, not a production database change made from this workspace.

Checkout now uses a 14px system-font base, 18px primary section headings, 14px
optional summaries/labels and 16px form controls. The handover summary is shortened
to Contact & handover (optional). Its nested fieldset legend remains available
to assistive technology but is visually hidden to remove the repeated heading.
Order handover editors outside checkout retain their visible legend. Optional
fields remain collapsed initially and conditional handover fields still work.

Frontend lint, UX and checkout suites and production build passed; all 21
backend fulfilment tests passed on isolated SQLite. Twelve local Chromium
WCAG A/AA and overflow checks cover enabled pickup checkout, owner pickup setup
and delivery with conditional contact/drop-off fields at 1440, 768, 390 and
320 pixels. Additional computed-style assertions verify the actual font sizes,
font family and hidden legend. Browser checks exercise blank-address prevention,
server hour validation, exact partial payloads, preserving unrelated drafts,
public pickup visibility and turning pickup off/on. Phone screenshots were
visually reviewed. No production setting, order, email or payment was changed,
and no migration is required.

The FreshCast quantity-formatting batch, broader Settings language/technical
layout and notification auto-dismiss review remain queued. This fix addresses
the reported checkout font/duplicate-heading issue; it does not claim those
other review batches are complete.

## Delivery labels and owner email settings review

Standard delivery and an express request currently use the same scheduling,
opening hours, travel buffer and shop fee. Express records a customer preference;
it does not book a courier or guarantee faster service. Both remain recorded in
order history because they are saved fulfilment choices. No planning rule,
payment, method code or stored snapshot was changed by this UI review.

Customer/owner labels now say **Delivery** and **Delivery · express requested**.
The checkout preference says **Ask about express delivery** and explains its
limits. Historical snapshot labels such as Owner delivery are rendered using
the current method label without modifying the original records. Express order
details and the owner handover view make the requested nature explicit. The
menu suggestion hint also now correctly directs time selection to checkout.

The Order email reminders overview now shows kitchen/customer email setup,
latest check and eligible customer queue counts. Readiness is explicitly email
setup readiness, not proof of an active automatic schedule or inbox delivery.
Missing setup, stale checks, failures and unknown results remain distinguishable.
A single closed **Email settings & history** disclosure holds test email controls,
recipient/sender addresses, sending setup, the schedule/history link and detailed
eligibility information. Routine UI uses **Your reminders go to**, **Sent from**
and **Send test email**, instead of environment-variable names and worker jargon.
The recipient is where kitchen reminders arrive; the sender is the website's
sending identity and may be a different address. Technical setup remains in the
linked developer guide. Backend configuration, consent, receipts, rate limits,
email payloads and scheduler behaviour are unchanged.

Frontend lint, UX, checkout, planner and recommendation suites and build passed.
Fifty-two backend diagnostic/activity/integration/fulfilment tests passed; one
PostgreSQL-only test was skipped on isolated SQLite (53 discovered). Sixteen
local Chromium WCAG A/AA and overflow checks cover open/closed Settings, stale,
failed and missing setup, and standard/express history at desktop/tablet/phone
sizes. Tests verify that refreshing or expanding details never sends email,
one explicit test click makes one mocked empty POST with a cooldown, and the
private status API rejects customers and anonymous requests. UI states and
legacy history labels use explicit fixtures; no real diagnostic email, reminder
worker, order mutation or production setting was used. Phone layout was visually
reviewed. No migration is required; live Vercel/email operation was not verified.

The broader notification auto-dismiss and FreshCast quantity presentation
reviews remain pending; this batch completes the reported reminder-panel wording
and delivery-label review.

## Batch: one delivery category and realistic sample inventory

New checkout offers Delivery or Self-collection. GrabExpress is a courier the
kitchen may arrange, not a separate fulfilment method in checkout. The express
request checkbox has been removed. Standard and legacy express records display
as Delivery and share one hourly delivery-run group. Legacy express requests
remain an order note, with original stored method and snapshot retained. Existing
checkout sessions with an unavailable legacy express option fall back to the
supported delivery method and require availability to be checked again. Fees,
accepted preparation plans and courier tracking data are unchanged.

Both stock seed paths now use plausible storage positions instead of putting
sample disclaimers in storage_location. The inventory sample notice recognises
both known generated batch prefixes. Provenance, identifiers and guidance records
remain intact. Existing database rows can be corrected with
[the one-statement SQL](../deploy/sql/refresh_sample_storage_locations.sql),
documented in [the storage guide](sample-inventory-storage-refresh.md). This is
separate from deployment; no migration or production connection was used here.

Twenty-nine focused backend tests passed on SQLite, with the two PostgreSQL-only
SQL checks skipped there. All three sample-storage checks passed on an isolated
TLS-enabled PostgreSQL 16 instance. Those include 31 matched rows across storage
cases, preserved non-location values, exact targets, custom/unknown rows left
alone, before/after zero-quantity audits, no changes on a second run and atomic
rollback if audit writing fails. Frontend lint, UX, checkout and planner suites
and build passed. Local Chromium checks one delivery choice, legacy history
notes and sample storage presentation on desktop/tablet/phone; production rows
remain unchanged until the SQL is run. Notification timing is the next batch.

## Batch: timed popup notifications

All global popup severities now hide automatically: success after four seconds,
information after six, errors after ten. Manual dismissal remains available.
Mouse hover and keyboard focus pause independently; leaving hover does not
restart a timer while the popup still has keyboard focus. Timers resume their
remaining duration instead of starting another full interval. Touch interaction
does not create a sticky mouse-hover pause.

UIProvider gives each newly raised notification an identity, including repeated
messages with the same text. App keys the popup by that identity, so a repeated
Add to cart message starts visible with a fresh timer after an earlier one faded.
Functional setAlert callbacks that return the current value retain its identity.
Auto-hide changes only popup visibility: form errors using the shared alert
source remain available inside the form. Inline validation and saved-state text
are not transient popups and are not erased on a timer.

Frontend lint, UX and checkout suites and build passed. Local Playwright clock
checks exercise real UIProvider/AppNotification/DialogFeedback modules: 4/6/10
second timing, repeated identical messages, pause/resume, focus surviving mouse
leave, touch behaviour, manual dismissal and retained inline errors. Four
WCAG A/AA and page-overflow checks cover 1440, 768, 390 and 320 pixels. Separate
production-bundle browser checks verify two repeated actual local Add to cart
notices and Settings saved each disappear without a click, while inline saved
confirmation stays. Only a fictional local basket/settings fixture was used;
no customer order, payment, email or production record was created or changed.
No migration is required. FreshCast quantity presentation is the next remaining
batch; the separate production storage SQL step still requires owner execution.
