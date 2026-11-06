# Website UI/UX review — November 2026

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

## Remaining batches

6. Sign-in, registration and chatbot dialogs: focus, recovery and mobile layouts.

Each batch will be checked against the existing client workflow. This list is
not a claim that all pages have already been reviewed or changed.
