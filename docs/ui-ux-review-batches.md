# Website UI/UX review — November 2026

## Follow-up visual review — owner feedback on 6 November

The earlier six batches are the first review pass, not a guarantee that all
visual defects were caught. The owner's subsequent page-specific feedback is
being handled in this follow-up sequence:

1. **Settings and shared admin controls — completed.** Native dropdowns have a
   consistent arrow inset and text padding. Packaging assignment rows and sales
   date filters align their inputs/actions. Settings shortcut navigation and
   setup/courier actions use deliberate controls rather than inherited prose
   underlines. Setup checks separate counts, actions and optional explanations;
   reminder evidence uses neutral cards with a working history shortcut.
   Website revision remains accessible under Technical details. Packaging cost
   guidance explains unknown versus genuine zero cost; no costs are invented.
2. **Basket, checkout and suggestions.** Reduce repeated product/unit details,
   align suggestion fields, and surface the basket's common offered weekdays
   beside the date selector. Provide suitable upcoming dates without suggesting
   that a weekday match reserves stock or confirms availability. Review the
   persistent basket bar, remove controls and checkout/basket action links.
3. **Account, sign-in and order actions.** Improve staff-profile spacing and
   save-button sizing; make returning from staff sign-in to customer registration
   explicit. Review the signed-out entry label, modal links, and preview/print
   actions in Orders.
4. **Public storage information and navigation.** Present date-based storage
   counts and optional average explanation more compactly. Review header/footer
   navigation and link hierarchy while retaining food-safety qualifications.

Batch 1 validation: focused render/utility tests, scoped lint, production build,
and isolated Chromium at 1366px and 390px. Browser checks measure aligned control
edges, check native select keyboard behaviour and arrow spacing, verify settings
deep links/focus and confirm that status/history actions make no mutations.
The existing packaging/cost backend suite passed 33 tests, including assigned
packaging totals and missing-cost behaviour. No live records or email were
changed. Live Vercel deployment is a separate check.

Financial scope: Sales reports revenue, while Costs & pricing shows estimated
food contribution and margin when ingredient and packaging costs are known.
Order contribution uses allocated ingredient batch costs and the packaging
estimate saved at acceptance. Unknown costs remain unavailable. Delivery costs,
payment fees, labour and overhead are excluded from food contribution, so it is
not net profit. This batch does not alter these calculations or force unknown
prices to zero.

## Batch 1: Sales and costs

Implemented separate Sales overview, Costs & pricing, and Order contribution
views. Detailed analytics, recipe estimates, cost assumptions and financial
ledgers remain available through progressive disclosure. Current packaging
estimates now match assigned packaging used at checkout. Ingredient cost entry
supports kg/litre conversions. Wastage requires review before stock deduction;
expense voids require confirmation. Historical unknown costs remain unknown.

Principles applied: clear task hierarchy, consistent controls, familiar units,
visibility of saved state, error prevention, keyboard focus, and touch targets.
The supplied food-app screenshots inform hierarchy and compact cards; the
owner workspace retains its own branding and operational terminology.

Validation: 72 backend tests; focused frontend utility, rendered-component and
report tests; production frontend build; real local Chromium checks at 1366px
and 390px. Browser checks cover cost conversion, read-only pricing, expense
entry/void, review-before-deduction and exact wastage deduction. All passed.
The isolated browser database contains artificial test fixtures only. These
checks do not establish live payment, inventory or deployment state.

## Batch 2: Orders and payment dialogs

Implemented compact order cards with a focused payment dialog, visible payment
status and full amount, clear proof/reference wording, and readable payment
history. Contact details and less frequent changes remain under order details.
Receipt confirmation shows the exact selected orders. Payment writes block modal
dismissal; refund entry requires an explicit result and completion confirmation.
Payment errors stay within the dialog and the opener regains focus on close.
Malformed or duplicate payment-record responses are rejected before showing write
forms. Existing server authorisation, version checks and idempotency remain.

Validation: payment-response utility checks, rendered order/payment components,
existing report tests, production build, and real Chromium interactions on an
isolated fixture database. Browser checks cover payment recording, escaped notes,
refund cancellation, focus and busy behaviour, exact bulk-receipt scope, separate
payment/food statuses, and 390px queue/dialog layouts. The focused backend run
passed 72 tests; six PostgreSQL-only tests were skipped on SQLite. No live records
were modified and no live deployment is asserted.

## Batch 3: Inventory and packaging

Implemented shared native ingredient/batch forms, consistent quantities and
controls, optional guidance/reference sections, clear adjustment previews and
success feedback. Date rules and stock-check tools remain available. Named
delete confirmations retain server protection for stock history. Packaging
removal requires a review of the deduction and balance; receiving stock keeps
one-step recording. Packaging history becomes labelled records on mobile.

Validation: 47 backend tests, form/expiry/guidance and stock utility checks,
production build, and local Chromium at desktop and 390px. The browser verifies
calculated deadlines, generated references, mandatory adjustment reasons,
version conflicts/reload, protected deletion and review-before-removal. These
are isolated fixtures; no live inventory records or expiry rules were changed.

## Batch 4: Settings and account pages

Implemented independently saved, collapsible Settings sections with direct links
that open nested controls. Saving one section preserves other drafts. Diagnostics
and setup checks load on first opening; email testing remains an explicit action.
Staff account forms have consistent spacing and save/error feedback. Customer
accounts can retry passkey-list reads, add backups with native confirmation, and
review a named key before removal; last-key protection is retained.

Validation: scoped-save and passkey-response utilities, settings/account/email
render tests, production build, and local Chromium at desktop and 390px. Browser
checks include independent saves, direct links and keyboard focus, lazy reads,
staff contacts and real WebAuthn ceremonies using virtual test devices. The
backend run passed 82 tests; four environment-specific checks were skipped. No
live emails or account records were changed by these isolated checks.

## Batch 5: Menu, basket and checkout

Aligned menu service hours with minute-aware checkout settings and directed time
selection to checkout. The basket keeps quantities and food totals without a
second area/time form. Checkout checks fulfilment/time before contact details,
then payment. Mobile placement controls remain visible with clear total and
next-step guidance. Inputs and the save-contact checkbox have consistent sizes;
loading is distinct from errors. Empty receipt selections preserve uploaded proof.

Validation: 96 backend tests, focused menu/basket/checkout/recommendation render
checks, production build, and local Chromium at 390px and desktop. Browser checks
cover quantity/discount totals, guest-to-account continuity, real passkeys,
receipt rejection/preservation, area fees, QR-only collection, cash delivery and
exact ingredient/packaging deductions. All records and payment images are local
fixtures; no live transaction or order was made.

## Batch 6: Sign-in, registration and Kitchen help

Aligned customer/staff dialog typography and controls. Customer registration keeps
name, phone and a passkey; staff sign-in keeps password credentials. Switching
customer modes moves focus and clears stale errors without losing entered details.
Staff recovery explains the separate customer passkey route. Pending sign-in and
confirmed basket additions block dismissal; readonly help requests can be cancelled.

Kitchen help opens with quick topics and retains English, Malay, Chinese and
explicit AI consent. Answers are validated for bounded content, supported modes,
internal links and quantity totals before display. Food planning retains a signed
review/confirmation before changing the basket. Failed basket reads after an
addition offer a refresh without repeating the addition. For the current client
workflow, delivery-time selection stays at checkout; scheduled mode retains its
existing availability controls. Primary-action hover and disabled colours stay
legible, and Escape restores the help launcher even after a submitted button loses
focus.

Validation: focused response and rendered-component checks, production build,
scoped lint, and local Chromium mobile/desktop interactions. Virtual native
passkeys exercise real registration and sign-in APIs; browser checks also cover
language/topic changes, malformed-response retry, staff recovery, pending guards,
and cart-refresh recovery with exactly one addition. The focused backend suite
passed 79 tests; five environment-specific tests were skipped on SQLite. These
checks use isolated records, no real AI request, bank transaction or live email.

The six planned UI/UX batches are complete. Live deployment and real-device
feedback remain separate checks; this is not a claim that every possible defect
has been eliminated.
