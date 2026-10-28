# UI/UX review after the October feature additions

This is the new review requested on 28 October, following the earlier completed
UX batches. The supplied Swiggy and Talabat screenshots inform hierarchy,
compact food rows, visible prices/actions and clear navigation. Dapur Kita keeps
its single-kitchen branding and actual preorder constraints. These are design
judgments and implementation checks, not measured customer conversion results.

## Batch sequence

1. **Menu discovery** — compact kitchen information, readable phone cards,
   labelled search/date navigation, category/results context and basket controls.
2. **Basket and checkout** — review fulfilment/time choices, bill hierarchy,
   optional fields, payment presentation and recoverable errors on phones.
3. **Customer follow-up** — orders, account, reminders, payment/tracking details
   and clear next actions; retain truthful payment/test and courier disclosures.
4. **Owner daily work** — orders, Planner, bulk updates and setup navigation;
   put work needing action before maintenance or explanatory material.
5. **Stock and decision evidence** — inventory/forms, FreshCast sources,
   analytics/reports and remaining owner screens, followed by shared regression
   checks for consistency and accessibility.

Each batch is a review of the existing features. It does not imply adding a new
model, courier provider, payment option or invented business data.

## Batch 1 — implemented

- Kitchen information uses a shorter header. The configured group discount stays
  visible; service area, collection location/hours and delivery hours are available
  together under Kitchen details. Failed detail reads do not invent fulfilment
  availability or show a stale promotion as verified.
- Desktop/tablet keep the photo grid. Phones up to 480 pixels use full-width food
  rows, a 112-pixel photo and larger name/price text so long meal/pack names and
  quantity controls have room. All quantity buttons have 44-pixel targets, with
  wrapping at intermediate widths to keep actions inside the card.
- The date shortcut keeps a visible For a date label on phones. Search clear also
  has a 44-pixel target. The result heading identifies the active category or
  search, with the count and a Reset filters action together. Counts and load-more
  copy say items/food, covering meals, boxes and packs.
- Recommendations still follow the first two actual catalogue rows; on narrow
  phones that now means two full-width food cards. The whole-order finder, budget
  modes, explicit basket replacement, and basket/checkout timing flow remain.
- Fixed the date shortcut focusing the newly added hidden menu-mode radio. It now
  opens the finder, scrolls the date field into view and focuses that date field.

The changes apply recognition over recall (visible labels and filter context),
progressive disclosure for secondary kitchen information, consistent actions,
readable type, generous targets and explicit error recovery. No screenshot
assets, fabricated reviews/urgency or immediate delivery promises were copied.

No backend API, database schema/record, forecast calculation, inventory allocation,
reminder, payment or courier integration is changed by this batch.

### Verification

Frontend lint, UX, recommendation, checkout and unit suites plus the production
build pass. Header coverage includes collection-only settings, disabled ordering
and failed detail reads. The date shortcut regression checks the actual date
field instead of whichever input happens to come first.

Local Chromium uses an isolated fictional SQLite catalogue with 24 active menus.
It checks search/clear, category selection/reselection, pagination, menu failure
and retry, guest sign-in, actual cart add/increment/decrement/remove, three dated
suggestions, and date-field focus. Ten full-page WCAG A/AA and overflow scans
pass across 1440, 1060, 1024, 768, 650, 390 and 320 pixel widths. Quantity-button
rectangles are checked at all seven widths for a minimum 44-by-44 target and for
containment inside their cards. Desktop and phone screenshots are also reviewed.

No production record was changed, no real message or payment was sent, and no
order was placed. These checks do not establish customer conversion improvement
or production deployment readiness. No migration is required.

## Batch 2 — basket and checkout

- Checkout has an itemised bill with menu thumbnails, per-unit × quantity, line
  totals, discount and fulfilment fee. It remains a sidebar on desktop; on phones
  and narrow tablets a native expandable summary leads the form with its count
  and total visible. Customers can inspect or edit the basket before submitting.
- The order action now explains the next missing requirement and links directly
  to its section: area, address, time/availability or payment. Pending reads/saves
  have their own status. The existing submit guards still decide eligibility;
  the explanatory helper never permits an otherwise blocked submission.
- The basket names time selection as optional at that stage and explains that a
  selection carries forward. Existing choices are reviewed in checkout instead
  of forcing another slot search. Collection search labels use collection terms.
- Basket quantity/remove targets are at least 44 pixels; Remove has a visible
  label. Intermediate-width wrapping keeps item actions in their cards. Mobile
  totals show Updating during a basket refresh instead of presenting the old
  amount as current.
- Checkout explicitly sizes the express checkbox, preventing generic text-input
  rules from stretching it. Email consent remains opt-in. Preparation detail,
  including multi-day preparation, stays available inside the existing disclosure
  while the availability result leads with whether the selected time can proceed.

The Swiggy/Talabat references inform the visible bill and reachable order action.
The changes apply recognition of current state, a clear next step, prevention of
mistakes and accessible native disclosure. Payment test labels, custom-request
confirmation, quote rechecking, storage and account boundaries remain in place.
No backend endpoint, model, database migration, provider connection or scheduler
has changed.

### Batch 2 verification

Frontend lint, checkout, UX, unit and recommendation suites and the production
build pass. Tests cover next-step priority, address-read errors, collection not
requiring a delivery address, pending/stale/failed availability, unconfirmed
requests and payment selection, plus bill arithmetic and refresh states.

The local browser checks basket controls and the collapsible bill at 1440, 768,
390 and 320 pixels, native summary expansion and placement, address saving,
section-link focus, selected-time carryover, delivery-to-collection switching,
quote failure/retry and a completed fictional cash-on-collection order. Ten
full-page WCAG A/AA and overflow checks pass; screenshots were visually reviewed.
The express checkbox and basket quantity/remove targets are measured directly.
All data is isolated test data; no production order, email, payment or courier
booking is made. No migration is required.
