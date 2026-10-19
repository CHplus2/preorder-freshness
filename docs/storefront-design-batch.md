# Responsive storefront design update

The supplied Swiggy and OpenTable references inform the browsing and ordering
patterns: food photography, category pills, a date finder, clear item controls,
an itemized bill and a persistent next action. Dapur Kita retains its green,
cream and serif brand treatment. The screenshot references are inspiration;
no external app assets, ratings, urgency claims or delivery promises were added.

## Customer experience

- Menu: illustrated introduction using existing credited food photos, searchable
  paginated catalogue, keyboard-accessible category buttons, compact date-finder
  shortcut, visible notice and daily limits, image failure placeholders, and
  inline basket quantity controls. The existing catalogue and cart APIs remain
  authoritative. Guests retain the existing sign-in action when adding food.
- Basket: item photos, per-unit and line prices, quantity/removal controls,
  optional whole-basket time check and an itemized summary. The summary uses the
  same food subtotal, active bulk discount, delivery charge and final total as
  checkout. Desktop uses two columns; mobile keeps checkout within reach.
- Checkout: shared three-step orientation and a reachable mobile total/action
  bar. Required fields, address handling, payment options, quote validation and
  the place-order flow remain in force. The action stays inside the form.
- Overlay spacing: basket actions, notifications and kitchen help have separate
  vertical positions. Footer padding preserves access to the final links.

Menu stock evidence and the date finder remain available. The fixed basket bar
is absent for an empty basket or a failed basket load. No model, API schema,
Supabase record or admin/FreshCast layout changes are part of this batch.

## Verification

Existing frontend utility, product UX and checkout rendering tests, changed-file
ESLint checks and the production frontend build pass. Local browser checks use
an isolated SQLite fixture and exercise 1440, 768, 650, 390 and 320 pixel widths:
category/search/pagination; empty/error/retry states; add/increment/decrement/
remove; guest sign-in action; broken-photo fallback; date-finder focus; selected
slot transfer; matching basket and checkout totals; quote success; and native
required-date validation. No checkout order is submitted by these checks.
Desktop/tablet/mobile screenshots were inspected, including overlay reachability.
Production Vercel deployment is separate from these local checks.
