# Home-kitchen UX improvement batches

## Direction

The supplied Talabat, Swiggy and OpenTable screenshots inform food discovery,
compact kitchen information, clear quantity controls and an obvious next action.
This application serves one home kitchen: retain Dapur Kita's green identity,
preorder notice and capacity checks. Marketplace promotions, invented ratings,
instant delivery claims and new social sign-in providers are not implied by the
references. The following priorities are usability judgments applied to this
implementation, rather than a claim of research with customers.

## Batch 1 — Menu discovery and meal details

Implemented on 20 October 2026:

- Replaced the large catalogue hero with a compact kitchen introduction so food,
  search and category controls appear earlier on phones and desktop. The kitchen
  contact link, service area and configured group discount use existing records.
- Moved optional guided date discovery below the food, retaining a shortcut that
  opens it and focuses the date field. Ingredient records remain secondary.
- Fixed reselecting an already active category: it previously cleared results
  without triggering a new request, leaving an indefinite loading state.
- Added clear filter recovery. Genuine empty menus and failed/malformed responses
  have different messages; failures retain a retry instead of reporting no food.
- Displayed restricted delivery weekdays on food cards alongside existing price,
  notice and quantity controls.
- Reorganized meal details into photo, name, price and ordering controls, followed
  by advance notice, delivery days, daily limits and an allergy contact action.
  Quantity and food subtotal are shown before adding; a successful addition links
  directly to the basket. Mobile keeps the purchase action at the bottom.
- Preserved reviews, image fallback, accepted menu status, sign-in requirements,
  account isolation and cart API behavior. Paused/archived details remain readable
  for earlier links, while their purchase controls are disabled.

The basket action remains a food subtotal: delivery and any group discount are
calculated in the basket/checkout. A daily menu limit is not a promise of remaining
capacity. Advance notice is measured before preparation, not simply delivery.
The privacy boundary remounts pages when signing in/changing accounts; no private
basket state is carried between accounts.

## Batch 2 — Owner orders and Planner

Implemented on 20 October 2026:

- Orders opens with active orders sorted by delivery, rather than completed
  history. Shortcuts show open orders, pending confirmation, ready/on-the-way,
  past-due and all customer orders. Search stays visible; less-used filters are
  grouped under More filters. Completed/cancelled records remain accessible.
- Generated history retains its separate view. Clearing filters preserves that
  source. Selecting a completed status switches to All orders, so the default
  active-work scope does not silently hide completed records.
- Preparation links open and focus the specific order in Planner. Query-string
  navigation updates the Orders view, including links to a completed order.
  The past-due preparation follow-up link opens the matching order queue.
- Update status names the existing edit action more clearly. Preparation,
  payment records and accepted recipes remain separate actions.
- Loading or failed order refreshes hide cached record mutation controls. Retry
  restores the queue from a successful read; a failed request is not an empty
  order list.
- Planner shows a counted Kitchen follow-up panel. Details and maintenance tools
  open on request; a successful cooking-step check appears after actionable
  exceptions within that panel. Missing accepted recipes remain visibly flagged
  before shopping.
- The date bar and compact workload summary lead the selected day's work. The
  monthly calendar opens with Choose from calendar. Daily updates use shorter
  explanations while retaining the ingredient-deduction and payment distinctions.
- The review panel's catalogue lookup is mounted only when expanded, avoiding an
  extra catalogue request during normal daily planning.

Verification: order-queue utility tests, Planner rendering/guard tests, existing
frontend utility/UX regressions, changed-file ESLint and a production build pass.
Local Chromium journeys exercise shortcut/search combinations, generated history,
completed-order links, missing-date review, failed-refresh recovery, the specific
order-to-Planner link, an actual plan preview/confirmation, calendar/view changes
and an actual delivery update that leaves payment unpaid. Eight page/viewport
checks at 1440, 768, 390 and 320 pixels report no automated WCAG A/AA violations
or document overflow. Desktop and phone screenshots were also inspected.

These checks use fictional records in an isolated SQLite database. This batch
changes frontend presentation/filtering/navigation, not production records,
server scheduling/payment/stock rules, forecast models or API schemas.

## Batch 3 — Inventory priorities and shared FreshCast navigation

Implemented on 21 October 2026:

- Inventory shows one stock-attention priority at a time, with visible group
  counts, three initial batch previews and Show all. Held, past-expiry, today's
  expiry, upcoming expiry and missing-date groups stay mutually exclusive.
  Remaining quantity, recorded value, incomplete costs and batch identity stay
  visible in the selected group's evidence.
- Held batches are excluded from the expiry-only summary counts and have their
  own table filter/status. Invalid calendar dates need review instead of rolling
  forward into a valid shelf-life category. Date checks use the Malaysia day.
- Removed duplicate top-level batch/ingredient totals; those counts remain with
  their lists. Search and filters have labels, reset and clearer empty states.
  Add ingredient, Add stock batch and Refresh records name the primary actions.
- Inventory reads are validated before replacing displayed records. A malformed
  initial response is a read failure, not zero stock. Failed refreshes retain an
  explicit warning and disable batch mutation entry points until records reload.
- Kitchen, Genpact and sample sources use the same FreshCast page headings and
  compact illustrated navigation across decisions, inventory evidence and demand
  analytics. Active navigation, source labels, provenance notices and context
  links remain available.
- All decision sources retain the five steps. Phones use a horizontal step bar
  that brings the active step into view without scrolling the whole page.
- Fixed a recommendation-label contrast issue and made the horizontally scrolling
  daily forecast chart keyboard-focusable.

The sources deliberately retain different controls and evidence: kitchen windows
use delivery-dated records, recipes and batch expiry; Genpact uses external center
and week selections with simulated operations; sample mode is explicitly a fixed
model-free example. Chart types and action capabilities follow those distinctions.
The original room illustrations, rescue tutorial and detailed evidence tools are
retained. No forecasting, allocation or scenario equations are changed.

Verification uses frontend utility/rendering regressions, changed-file ESLint,
a production build and local Chromium journeys. Kitchen requests use real APIs
against an isolated fictional SQLite fixture. Genpact success layouts use explicit
browser-only contract fixtures because the trained runtime is not part of the
local UI fixture. Those checks do not validate a trained Genpact model or accuracy.
External API failure is separately checked to stay an error without a sample
fallback. Thirty page/viewport checks cover Inventory plus three FreshCast views
for all three sources at 1440, 390 and 320 pixels. No automated WCAG A/AA
violations, page errors or document overflow were found after fixes. Screenshots
were also inspected. No production records or model artifacts are changed.

## Batch 4 — Home, customer orders, account and contact

Implemented on 21 October 2026:

- Home brings the current menu immediately after a shorter introduction. Phone
  cards pair a small photo with the meal name, price and notice. Decorative hero
  artwork stays on desktop; kitchen information and occasion discovery follow
  the food. Missing photos retain a neutral fallback.
- The public menu preview validates its read and distinguishes loading, a genuine
  empty menu and a failed request with retry. It no longer relies on shared
  product state or reports a request failure as a menu still being prepared.
  Group-offer copy uses only a valid configured percentage and item threshold.
- My orders separates Current, History and All orders, starts with current work
  when present, and renders ten records at a time with Show more. Completed and
  cancelled records remain available. Unknown statuses remain in Current.
- Loading/failed order refreshes hide cached cards and payment/delivery controls.
  Order cards retain requested-time warnings, payment status, original address,
  Sandbox disclosure, review links and delivery changes. Malaysia delivery times
  omit seconds and invalid/missing values prompt contact rather than show dates.
- Phone order progress keeps all five stages in a compact row. Order titles,
  filter counts and per-order contact actions have a clearer visual hierarchy.
- Account has separate profile/address sections and useful order/menu shortcuts;
  checkout appears only with a successfully loaded nonempty basket. New customers
  get a blank address form from the API's legitimate empty response. Invalid
  records do not become editable blank forms or successful save confirmations.
- Account saves disable their fields while running, retain drafts on errors and
  distinguish an unverified save from success. Editing removes the prior Saved
  message. An existing order retains its address snapshot when the default changes.
- Contact uses a compact heading and puts the enquiry first on phones. An order
  link prefills its reference into an explicit messaging-app draft. The customer
  still sends it in their own app. Unconfigured contact channels remain clear;
  no email or WhatsApp message is sent by this batch.
- Shared mobile/account disclosures close on Escape and return focus to their
  toggle. Outside clicks dismiss them, and opening one closes the other.
- How it works and FAQs distinguish available slots checked on order submission
  from custom requests awaiting kitchen confirmation.

Verification: frontend utility and customer rendering regressions, changed-file
ESLint, a production build and Chromium journeys against an isolated fictional
SQLite database. Journeys cover actual profile/address saves, failed and malformed
reads, uncertain saves preserving typed entries, history pagination, order refresh
failure/retry, and order-specific contact drafts. Twenty page/viewport scans cover
home, contact, how-it-works, account and customer orders at 1440, 768, 390 and 320
pixels, with no automated WCAG A/AA violations, document overflow or page errors.
Desktop and phone screenshots were inspected as well.

These are customer presentation and navigation changes. Production records,
scheduling rules, payments, forecasting and API schemas are unchanged. Local
checks do not establish production deployment readiness or replace user testing.

## Next batch

**Sign-in and remaining forms:** review authentication dialogs, notifications,
validation recovery and keyboard focus across the remaining customer forms.
This is the next review area, not a claim that every page has been audited.

## Verification and boundaries

Batch 1 uses frontend utility/rendering regressions, changed-file ESLint, a
production frontend build and Chromium checks against an isolated SQLite fixture.
Browser verification covers menu filters/pagination/retry, product availability,
quantity/basket feedback and layout/accessibility scans at 1440, 768, 650, 390
and 320 pixel widths. All ten page/viewport scans passed with no WCAG A/AA
violations reported by axe and no horizontal overflow. Screenshots were also
inspected: an intrinsic image-height issue found visually was fixed so meal
names and details are not pushed below an oversized photo.

No production database records, scheduling rules, payment behavior, forecast
models or API schemas are changed by this batch. Local verification does not
establish production deployment readiness or replace user testing.
