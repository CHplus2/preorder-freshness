# Kuching home-food workflows

Review date: 23 October 2026. The five Facebook excerpts supplied by the project
owner are examples, not interviews or verified requirements from those sellers.
No seller was contacted. No external contacts, customers or offers were imported.

Dapur Kita currently fits a single home kitchen selling meals and bakes by
advance order, with owner delivery and shared preparation capacity. The examples
share the need for branding, clear prices/quantities, order records, availability
and payment tracking, but have different fulfilment policies. Optional settings
are appropriate; FreshCast, recommendations and existing payments remain useful
for other profiles. These posts cannot establish every operator's requirements.

| Case / customer journey | Existing support | Gap / batch |
| --- | --- | --- |
| Daily bento: order lunch before a deadline; receive before noon. Owner caps tomorrow's quantity and prepares a delivery run. | Daily menu capacity, recipes, working hours, scheduling, orders and payments. | **1:** cutoff. **2:** lunch delivery window and delivery areas. “5PM daily” does not prove whether the deadline is the previous day; owner chooses the offset. |
| Curry chicken: choose a dish, quantity and delivery date. Owner publishes its price and availability. | Branded menu, images/descriptions/social links, recommendations, date suggestions, preparation and requests. | **1:** optional sale dates/cutoff; leave unset for flexible orders. Dietary suitability still needs the owner. |
| Festive fixed box: buy boxes of 3 original + 2 salted egg + 2 dark chocolate + 2 matcha pieces; dispatch in December. | A product can already represent one box, with recipe and price per box. There are no flavour-substitution controls to disable. | **1:** offered dates. **3:** explicit selling unit, fixed contents and no substitutions. **4:** dispatch/shipping windows. “Ships in December” is not an exact arrival promise. |
| Kacangma: choose small/medium/large and collect at Hui Sing 7am–2pm. | Separate products can represent sizes with their own recipe and price. | **2:** pickup, location and collection hours. Current 9am–9pm delivery rules cannot represent 7am pickup. **3:** size/serving guidance and grouping. |
| Rojak: sauce alone or fruit/sauce set, one date, pickup or GrabExpress. | Separate products, shared ingredients, inventory and daily limits. | **1:** single offered date. **2:** pickup/customer-arranged courier, responsibility and fees. The example's 22 Oct 2026 date is past; do not create it as a live offer. |

## Batch 1: preorder dates and cutoffs

In Menu management, edit/create a menu → **Recipe & preorder settings** →
**Preorder dates & cutoff**:

- Add specific delivery dates for occasional sales. Empty means regular ordering
  on the existing delivery weekdays. Both restrictions apply when both are set.
  Up to 90 dates can be recorded. Past dates may remain but cannot be booked;
  the existing 90-day future booking limit still applies.
- Enable a cutoff and choose a Malaysia time plus days before delivery. **17:00
  and 1** means before 5pm the day before delivery. **0** means the delivery day.
  At the cutoff instant ordering is closed. Turning it off restores flexible
  ordering. Existing products default to no dates restriction and no cutoff.

The cutoff does not replace cooking advance notice. The default `lead_hours=24`
means 24 hours **before preparation starts**, not before delivery. A daily lunch
seller must configure realistic notice, batch sizes, step times and capacity;
setting 5pm alone cannot make next-day lunch feasible. No lead time, freshness
allowance or capacity is automatically relaxed.

Menu cards and product details show configured rules before adding. Cart and
checkout show common dates/cutoffs, identify incompatible baskets and recheck
availability on the server. Searches can jump to the next offered seasonal date
beyond the next week. The kitchen planner still determines actual availability.

Quotes and checkout reject unoffered dates/closed cutoffs, including custom
unconfirmed requests. A basket is not a reservation: leaving it open before a
cutoff does not preserve ordering rights afterwards. Checkout locks and reloads
menus before checking. Accepted orders retain saved terms. Replanning the same
delivery uses original order notice; a changed delivery uses new notice. Legacy
snapshots without these fields remain flexible. Adopting current settings in
Planner remains an explicit owner choice.

Date recommendations share these checks. The shopping assistant's date-eligibility
flag includes dates/cutoffs; adding to a basket never confirms availability.
FreshCast keeps its historical forecasts but excludes additional unbooked demand
outside offered dates or after the cutoff. Confirmed requirements remain
independent. A cutoff adjustment explains the raw-versus-plannable difference.
This batch does not train a model or establish forecast accuracy.

## Remaining batches

**Batch 2 implemented:** optional collection/delivery methods, separate handover
hours, location/instructions, delivery areas and fees are now connected to cart,
checkout and accepted-order planning. See [batch 2 details](HOME-FOOD-FULFILMENT.md).
It does not book Grab or implement festive shipping. The list below retains the
original roadmap. Batch 3 adds explicit selling units, size/serving guidance and fixed contents; see [batch 3 details](HOME-FOOD-SELLING-UNITS.md). A shared size-variant selector remains future work.

2. **Fulfilment:** owner-controlled pickup/delivery, locations/areas, collection
   and delivery windows, fees and buffers. Pickup should not require a shipping
   address or travel buffer. Cooking hours and handover hours are separate.
   Customer-arranged Grab delivery is not a booking integration with Grab.
3. **Units and offers:** boxes, sets, size/servings, fixed contents and no
   substitutions across menu/basket/receipts/recipes. Two boxes means two selling
   units, not two pieces or diners. Keep existing separate menu products usable.
4. **Operations and dispatch:** workload/quantities by fulfilment slot, sold-out
   messages, payment/cancellation handling, seasonal shipping and dispatch-versus-
   arrival wording. Ingredient stock and production capacity are different.
   Separate orders are not automatically combined into one cooking batch.

These are planned improvements, not a claim that all five sellers can use the
current release without workarounds. Follow up with owner interviews and task-
based usability tests; no measured conversion improvement is claimed.

## Release and verification

Migration `0019_product_preorder_windows` adds optional columns. It does not seed
offers, invent order dates, change payments or modify inventory. Back up the
private database, apply migrations from the existing connected maintenance
terminal, then redeploy. After pulling the code, from the Windows repository root:

```powershell
.\backend\venv\Scripts\python.exe backend/manage.py migrate --plan
.\backend\venv\Scripts\python.exe backend/manage.py migrate
```

Keep the working `DATABASE_URL` and `DATABASE_SCHEMA=django_app` in that terminal.
Run migration before the new version serves requests. The existing Vercel release
check rejects pending migrations; redeploy after migration if needed.

Validation: **156 backend tests passed** using isolated fictional SQLite records:
defaults, exact Malaysia/UTC
cutoffs, same-day vs previous-day cutoff, independent notice, dates plus weekdays,
mixed baskets, seasonal searches, stale baskets, accepted/legacy terms,
serialization, owner permissions and constrained FreshCast demand with confirmed
bookings retained. Frontend utility, UX, checkout, recommendations, shopping and
predictive regressions passed, as did changed-source lint, migration consistency
and a production build. Twenty-one browser checks cover owner editing and
customer menu/detail/cart/checkout at 1440, 768, 390 and 320 pixels. Two further
checks verify a visually corrected mobile cutoff toggle. No automated WCAG A/AA
violations, document overflow or page errors were reported; screenshots were
inspected. These automated checks do not replace usability sessions with owners.
Local verification does not apply the production migration or prove Vercel
deployment readiness.
