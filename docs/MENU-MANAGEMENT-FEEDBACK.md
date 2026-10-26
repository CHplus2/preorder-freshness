# Menu editing and removal

Reviewed 26 October 2026. No database migration is required.

## What changed

Menu management exposes **Delete** for each row. An unused menu opens a named,
cancelable permanent-deletion confirmation. Confirmed deletion removes the menu,
its current recipe and basket lines; it does not remove raw materials or stock.
The dialog prevents duplicate submissions and keeps API failures inside itself.

Menus referenced by any order, including cancelled/completed orders, offer
**Archive menu** instead. Already archived menus explain why they remain in
history. The server independently rejects deleting used menus with HTTP 409 and
`code: menu_used_in_orders`, including when an order arrives after the owner's
list was loaded. This keeps accepted recipe/menu identity and forecasts intact.
Deleting must not rewrite customers' bookings to make a test record disappear.

Staff catalogue/detail responses include a read-only `can_delete` boolean, using
an indexed existence annotation for listings. It is excluded from public
serialization. DELETE takes the menu and affected basket locks without waiting;
a concurrent checkout/edit returns HTTP 409 with `code: menu_busy`. Neither a
busy conflict nor a used-menu conflict partially removes records. Normal public
and staff aliases retain their existing staff-write and CSRF protections.

Creation/editing now share one form. Required name, price and category appear
together before optional recipe/offer/photo details. Client validation flags each
field, links its message through aria-describedby, and focuses the first invalid
input. Missing values give “Enter a price” or “Choose a category”; price validation
also checks positive value, money precision and the supported maximum.

The form owns its error state. Product mutation helpers accept an optional local
error callback, so these failures do not raise the global notification copied by
the previous DialogFeedback component. There is one local alert summary, with
field messages below the affected inputs. Server responses are translated to
field instructions rather than raw serializer type jargon. Input and uploaded
photo values remain intact after rejection. An unconfirmed save outcome explains
how to check the list and prevents blind repeated creation. Successful saves and
deletions retain one ordinary success notification. Photo uploads and preparation
editing remain available. Native dialog handling owns focus and body scrolling.

## Courier clarification

The existing **Orders → Courier tracking** stores the owner's carrier name,
reference and optional public HTTPS link after the owner arranges delivery.
Customers open that carrier link for live information. No courier API account or
sandbox is necessary. The application neither books/pays the courier nor fetches
carrier events; saving tracking does not mark food dispatched/delivered or change
payment. No courier behavior was changed in this correction.

## Verification

- 48 targeted backend checks passed (one PostgreSQL-only skip), covering menu
  lifecycle, accepted records and the previous extensions. A further 39 security,
  offer and catalogue checks passed with the two new row-lock checks skipped on
  SQLite.
- All 10 menu-lifecycle tests passed on isolated PostgreSQL, including refusal
  during a held checkout/menu lock or basket-edit lock and successful deletion
  after release. Orders, recipes and baskets remain intact on conflicts.
- Frontend utility/UX tests, changed-source lint and production build passed.
  Whole-repository lint's two pre-existing unrelated errors remain unchanged.
- Nine browser/accessibility checks covered client/server field rejection, one
  alert surface, retained entries, create/delete/cancel, guarded archive,
  unchanged order records, edit validation, photo upload and uncertain-save
  handling at 1440, 390 and 320 pixels. Two final checks measured message spacing
  below focused inputs and rechecked mobile/desktop accessibility. No automatic
  WCAG A/AA violations, document overflow or page errors were found. Screenshots
  were inspected.
- All mutations were against fictional local fixtures. Production menu/order/
  inventory records were not removed. Forecast models/artifacts are unchanged.
