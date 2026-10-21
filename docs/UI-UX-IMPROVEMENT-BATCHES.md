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

## Next batch

**Shared pages and navigation:** review home, account, support, forms and customer
order progress for typography, keyboard use, contrast, focus, loading/empty/error
states and responsive spacing. This is the next review area, not a claim that
all remaining pages have already been audited.

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
