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

## Remaining batches

3. Inventory and packaging: stock/date forms, quantities, tables and errors.
4. Settings and account pages: plain language, sections and profile forms.
5. Menu, basket and checkout: responsive cards, totals, forms and feedback.
6. Sign-in, registration and chatbot dialogs: focus, recovery and mobile layouts.

Each batch will be checked against the existing client workflow. This list is
not a claim that all pages have already been reviewed or changed.
