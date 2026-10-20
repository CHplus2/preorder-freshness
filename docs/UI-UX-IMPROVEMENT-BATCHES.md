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

## Next batches

1. **Owner orders and Planner:** review how a home owner sees today's workload,
   requests needing confirmation, ready/delivered actions and exceptions. Keep
   routine work prominent and planning explanations secondary. Check mobile
   reachability, status/action wording and error recovery with actual workflows.
2. **Inventory and FreshCast:** review stock and expiry priorities, evidence
   density, actions and comparison consistency across kitchen, Genpact and sample
   sources. Preserve differences required by available evidence and actual
   operational capabilities; do not turn illustrative scenarios into promises.
3. **Shared pages and navigation:** review home, account, support, forms and
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
