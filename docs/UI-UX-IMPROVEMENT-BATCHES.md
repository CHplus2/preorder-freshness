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

## Next batches

1. **Inventory and FreshCast:** review stock and expiry priorities, evidence
   density, actions and comparison consistency across kitchen, Genpact and sample
   sources. Preserve differences required by available evidence and actual
   operational capabilities; do not turn illustrative scenarios into promises.
2. **Shared pages and navigation:** review home, account, support, forms and
   customer order progress for typography, keyboard use, contrast, focus,
   loading/empty/error states and responsive spacing.

These are sequenced review areas, not claims that every remaining page has already
been audited or that every listed change is necessary.

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
