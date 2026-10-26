# Photos, sizes, tracking and shared cooking

Reviewed 26 October 2026. These are working extensions to the four case-study
batches. Local tests use isolated fictional records; no production orders,
payments, stock, carrier bookings or customer messages are changed by release.

## Owner photo uploads

In **Menus → Create menu / Edit & steps → Menu photo**, select **Upload from your
device**, wait for the preview, then save the menu. Pasting an external public
image URL remains supported. Cancelling an edit does not change the menu photo.

Only staff can upload, through the existing session/CSRF checks. Actual image
decoding validates still JPEG, PNG or WebP files up to 4 MiB, at least 16 pixels
on each side, at most 12,000 on either side and no more than 20 megapixels. SVG,
animation, malformed content and oversized inputs are rejected. Images are
oriented, resized to at most 1600 pixels, stripped of metadata and re-encoded to
WebP at most 512 KiB. File names and client-supplied content types are not trusted
as proof of image content. Existing transparent images keep their alpha channel.

The small sanitized images live in the application's PostgreSQL database, not
Vercel's ephemeral filesystem. Public content-addressed paths remain valid across
deployment URLs. The image endpoint sends WebP, nosniff, immutable cache headers
and an ETag; conditional reads avoid loading image bytes. Authenticated API
requests may retain the application's stricter no-store policy. Uploads are
deduplicated by sanitized content. Shared-database attempt limits cap each owner
at 30 uploads per 15 minutes. An uploaded photo is public, suitable for a menu;
this is not private document storage.

Cancelling after upload can leave an unreferenced photo. It remains in the
database and counts towards the database storage allowance; no automatic
destructive cleanup is performed. Database backups include uploaded photos.
GitHub source/model backups do not include the private application database.

## Size choices

Create separate products for small/medium/large, each with its own price, recipe,
yield and capacity. Give them the same **Size group** under **Selling unit &
contents**, and set each **Size name**. The product detail page then offers size
links with prices. Switching sizes opens that product; it never silently replaces
an existing basket line or converts ingredient quantities. Active products in the
same exact group are returned, up to 20. Catalogue cards continue to show each
explicit product. Historical orders keep their accepted size/unit terms.

## Courier tracking

Open an order in **Orders → Courier tracking**. Enter the carrier, reference and
optional public HTTPS link. The saved reference appears to the customer in My
orders. Only the owner can write it, with an order-version check and amendment
audit. Collection and cancelled orders cannot acquire courier references.

No courier API or sandbox is required. The application records owner-entered
information; it does not fetch carrier events, book or pay a courier, infer an
ETA, send a tracking message, or change order/payment status. Customers use the
carrier link for live information. Track packing/dispatch/delivery separately.

## Shared cooking

Open **Planner → Shared cooking**, choose a work date and preview a compatible
group. The current/proposed hands-on reservation, each order's proposed interval
and actual cooking steps are reviewable before confirmation. The owner explicitly
confirms; bookings are never silently moved in the background.

The first version combines 2–10 confirmed, future, pending **single-menu** orders
with identical product identity, accepted preparation/selling settings, accepted
ingredient quantities and units, delivery instant and dispatch buffer. It uses
the combined ordered quantity and accepted batch-size/timing rules. Different
menus, times, recipes or started work remain separate. Candidate discovery checks
the first 100 pending orders on the chosen delivery date. A proposed combination
can still fail kitchen constraints; no holding, notice, equipment, working-hour,
pause or daily-capacity limit is relaxed.

The whole kitchen is locked before recomputing and applying plans; order/menu
locks are acquired consistently. Signed previews expire after ten minutes, bind
the owner, selection and computed plan, and reject changed commitments or
availability. Repeated/concurrent confirmations of the same request apply once.
Each order retains a reference to the common reservation. Scheduling, the daily
agenda, conflict calculations and calendar export count the common tasks once;
customer handovers stay separate. Customers do not receive other order IDs.

Ingredients, FEFO deduction, consumption records, receipts/refunds, fulfilment
and sales history remain per order. Marking one order ready deducts only that
order's accepted ingredients, once. Cancelling a member does not assume the
remaining physical batch became smaller: its reservation stays conservative.

Before changing a member's preparation/delivery time, use **Preview separate
plans**. Every original member must be selected. All active members must still
be pending and future. Separate plans must fit with all other commitments; a
failure leaves the existing shared reservation intact. Started batches need
actual-progress follow-up, rather than retrospective reservation edits.

## Database upgrade and release

Photo persistence adds **0022_menu_photo**. Back up the private database, then
apply this additive migration before promoting the release. Existing menus,
orders, payments and stock are not rewritten.

Use either the existing connected maintenance terminal:

```powershell
.\backend\venv\Scripts\python.exe -m pip install Pillow==12.3.0
.\backend\venv\Scripts\python.exe backend/manage.py migrate
```

or run the complete [Supabase SQL Editor script](../deploy/sql/0022_menu_photo.sql)
using the project's existing `django_app` schema. The SQL path needs no terminal
password changes; it checks migration 0021, creates the photo table atomically,
records migration completion and tolerates an already-completed upgrade.

The Vercel release gate still rejects pending migrations. Keep the tested
candidate on a staging branch until the target schema is upgraded, then promote
the same commit to main and integration. Do not disable the release gate or
present a failed build as a successful deployment.

## Validation

- Full backend regression run: 634 tests, passing with 11 environment-dependent
  skips (9 PostgreSQL-only, 2 requiring the real Genpact artifact).
- Isolated PostgreSQL: 24 feature/inventory/concurrency tests passed, followed by
  16 final feature checks including a new concurrent shared-confirmation test.
  The latter confirms one application and one idempotent replay with two audits.
- The schema-qualified SQL upgrade ran twice on an isolated `django_app` schema,
  preserving existing products/photos and matching Django's migration graph.
- Frontend utilities, UX, planner, checkout, recommendations, predictive,
  shopping, image pipeline, PayPal and escrow regressions passed. Production build
  and changed-source lint were checked; existing unrelated whole-repository lint
  errors remain unchanged.
- Thirteen browser/accessibility checks covered real file selection/upload/save,
  size navigation, owner/customer tracking, shared preview/confirm/separation and
  deduplicated agenda. A second pass verified the improved confirmation layout.
  Widths included 1440, 390 and 320 pixels, with no automated WCAG A/AA violations,
  horizontal document overflow or page errors. Screenshots were inspected.
- Forecast algorithms and model artifacts are unchanged. These checks establish
  neither real-customer predictive accuracy, conversion uplift nor food safety.
