# Website UI/UX review — November 2026

## Follow-up visual review — owner feedback on 6 November

### Sign-in scrollbar regression

Overlapping native dialogs previously saved separate body-overflow snapshots.
Closing the older dialog first could unlock the background prematurely; closing
the remaining dialog could then restore `hidden` with no dialog left. Shared
scroll-lock ownership now restores the original per-axis inline styles only
after the final dialog closes. Cleanup is idempotent and preserves original
CSS priorities. Authentication, dismissal guards and dialog focus rules remain
unchanged.

Validation: four lock-lifecycle regression tests, focused dialog/account render
checks, scoped lint and production build passed. Local Chromium reproduced the
original failure before the change and verified both closing orders, StrictMode,
wheel scrolling, original CSS priorities, repeated customer/staff switches,
failed/successful staff login, direct admin login, menu-editor Escape and packaging
Cancel. Tests used isolated fixtures; no live accounts or stock were changed.

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
2. **Basket, checkout and suggestions — completed.** Basket cards keep prices,
   selling units and quantity controls visible; contents and individual schedules
   move into Item details. Shared ordering days use a compact summary. Checkout
   shows offered days beside its date field and up to seven upcoming ordering
   dates, derived from every menu's weekdays, fixed dates and cutoffs. Closed
   handover days are skipped. Invalid manual dates are explained beside the field,
   invalidate the draft, and clear shared selection/old quotes before stock checks.
   Delivery and pickup keep their own hours. Dates do not promise recorded stock.
   Suggestion inputs align in three/two/one columns with optional search rules.
   The basket shortcut sits in normal page flow while the finder is open and
   returns to its floating position when closed. Remove and Edit basket actions
   have consistent visible controls.
3. **Account, sign-in and order actions — completed.** Staff and customer
   sign-in have explicit arrow/back controls. Switching through staff sign-in
   preserves the in-memory customer draft and checkout return path; closing it
   clears the draft, and successful authentication retains the existing account
   guards. Account dialogs restore the header entry if their original opener was
   removed during a switch. The signed-out entry reads Join / sign in. Staff
   profiles separate the sign-in reference from editable names/phone and use a
   compact save button. Queue and daily-summary print actions use outlined
   controls with printer icons, safe new tabs and unchanged explicit printing.
4. **Public storage information and navigation — completed.** Four compact cards
   separate within-date stock, past-date stock, held stock and records needing
   review. Safety qualifications stay visible; detailed explanations and the
   date-based average are optional. Records load on first opening, with explicit
   refresh/retry and response validation. Unknown averages remain distinct from
   actual zero. Header links use active/hover/focus states; the footer groups
   navigation, contact and utility links. Phone/tablet navigation restores focus
   on close and desktop resize, and Kitchen help sits with contact links on phones.

Batch 1 validation: focused render/utility tests, scoped lint, production build,
and isolated Chromium at 1366px and 390px. Browser checks measure aligned control
edges, check native select keyboard behaviour and arrow spacing, verify settings
deep links/focus and confirm that status/history actions make no mutations.
The existing packaging/cost backend suite passed 33 tests, including assigned
packaging totals and missing-cost behaviour. No live records or email were
changed. Live Vercel deployment is a separate check.

Batch 2 validation: date-unit checks cover weekday intersections, fixed sale
windows, exact cutoff boundaries, closed handover hours, Malaysia dates and the
90-day horizon. Focused rendered-component checks and build pass. Existing order,
preorder-window and basket-guide backend tests discovered 74 tests: 72 passed,
two PostgreSQL-only concurrency checks skipped on SQLite. Isolated Chromium
checks verify no quote for an invalid weekday, removal of stale availability,
shortcut recovery, separate pickup hours, a cash placement with the expected
fee/discount and stock deductions, responsive suggestion controls, one-menu
alternatives, optional budgets and unobstructed basket navigation. No live
customer, payment or inventory records were used or changed.

Batch 3 validation: focused account/order render tests, scoped lint, production
build and isolated Chromium at desktop, 390px and a 320px short viewport. Browser
checks cover registration/sign-in/staff return paths, retained checkout context,
cleared errors, pending guards, virtual native passkey registration, focus return,
staff-profile spacing/save/phone normalisation, and queue/daily print previews.
Printing is invoked only by the explicit print button. Existing passkey,
password-sign-in and checkout-contact backend suites discovered 34 tests: 31
passed, three environment-specific checks skipped. No live accounts, email or
customer records were changed.

Batch 4 validation: storage-response utility checks, focused public-component and
navigation tests, scoped lint, production build and five existing backend
freshness-maths tests passed. Isolated Chromium checks at desktop, 390px and
320px cover lazy requests, refresh/retry, unknown/zero/empty records, malformed
responses, overlapping held/past-date counts, mobile focus and desktop resize.
Footer contact/help controls and photo credits remain reachable with a basket.
No live inventory, customer or email records were changed. No migration is needed.
All four requested follow-up batches are complete; source publication does not
establish successful live Vercel deployment or rule out future UI defects.

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
