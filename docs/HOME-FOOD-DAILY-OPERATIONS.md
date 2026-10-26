# Home-food case study — batch 4

Reviewed 26 October 2026. This batch improves daily local handovers and adds a
separate enquiry route for seasonal parcel offers. It does not book a courier,
take a parcel payment or promise an arrival date. The user's Facebook examples
involve private enquiries; no seller was contacted or imported into this store.

## Daily operation

Open **Planner → Collection & delivery runs**, then choose the work date.

- Confirmed orders are grouped by Malaysia hour and fulfilment method, retaining
  each exact agreed time. Collection, owner delivery and express requests have
  separate groups. Totals count accepted selling units, such as boxes or meals;
  serving estimates and pieces inside a pack do not multiply these totals.
- Pending/processing orders need a valid confirmed preparation window. Missing,
  unconfirmed or stale plans go to preparation review rather than inflating run
  totals. Food already marked ready or dispatched remains a physical handover
  task. Follow-up counts include past-due work across dates and missing dates.
- The run's primary action marks food ready, collected or delivered. Preparation
  start and dispatch tracking remain available in **Review plan**. Mark ready
  deducts accepted ingredients once; handover does not record a payment.
- **Open packing list** works even when navigating within Planner. Packing
  excludes unconfirmed or missing/stale preparation and identifies excluded
  records for review; it does not silently print them as confirmed production.
- Grouping never combines recipes, moves times or reserves a driver. A solo owner
  should block driving time in Kitchen availability before accepting more work.
  Shared worker/equipment constraints, accepted terms and manual arrangements
  retain their existing rules. The display clock updates each minute; the plan
  still needs refreshing after external order/stock changes.

Orders now has **Payment follow-up** and **Cancelled / refunds** queues. Unpaid
completed orders and relevant archived-menu records remain visible for financial
review. Requests awaiting confirmation stay in the confirmation queue. Counts
match each queue's scope. An explicit order reference can open archived history.
Cancellation closes a booking but does not itself refund money or restore used
ingredients. Payment records remain authoritative; this batch adds no automatic
refund, reconciliation or reminder messages.

## Capacity and ingredient stock

Hourly search exposes `unavailable_code: daily_capacity` when the menu's dated
quota prevents the plan, including requested quantity and existing bookings in
the reason. It does not call missing ingredients a sold-out kitchen slot.
Quantity limits, incompatible dates/weekdays and recipe/resource constraints keep
their existing bounded-search behaviour. Future ingredients may be purchased.

When kitchen time fits but recorded ingredients do not, checkout shows an
explicit procurement message before ordering. The advisory stock preview excludes
unconfirmed requests without preparation reservations. It still allocates usable
stock to scheduled unpaid bookings, since cash-on-handover orders are valid
commitments. No inventory is reserved by a quote; actual cooking keeps the normal
FEFO, expiry, quarantine and one-time deduction checks.

## Seasonal parcel enquiry

In **Menu management → Edit & steps → Selling unit & contents**, choose
**How customers order → Shipping enquiry — agree arrangements first**. Enter the
dispatch start/end dates and an optional arrangement note. For example, a
December fixed gift box can show 1–31 December without calling that an arrival
promise. Keep its unit, price and fixed contents explicit.

The offer remains in the public catalogue. Its card/detail uses an enquiry action
instead of Add/checkout, with the dispatch window and a contextual Contact topic.
The user chooses whether to open WhatsApp/email or copy the prepared message.
An enquiry creates no order, payment, preparation reservation or sent message.
Past dispatch windows are labelled ended, with an invitation to ask about a later
release. Local preorder date/cutoff controls are not presented as parcel arrival
controls. Switching back to local ordering retains the existing recipe setup
workflow; no cooking steps or stock are invented.

The server rejects enquiry-only offers at cart creation/increases, assistant
addition, quote and checkout, even if an older basket already contains one or
the client tries a custom-time request. Decreasing/removing a stale basket line
remains possible. Search returns `shipping_enquiry`, not endless hourly attempts.
Instant discovery may show the offer, while the date guide, transactional
assistant and menu-help suggestions do not offer it as a bookable local meal.
Shipping questions go to owner review. Existing accepted local orders can still
be replanned if the current menu later changes to enquiry-only.

FreshCast retains recorded history and raw forecasts. Additional speculative
local ingredient demand excludes shipping-enquiry offers, with
`shipping_enquiry_excluded` explaining the adjustment. A private conversation
does not become a known booking or assumed sale. Confirmed accepted requirements
remain separate. Models, training and forecast algorithms are unchanged.

This is a conversation route for shipping arrangements, not an online parcel
checkout or shipment-management service. Carrier booking, parcel tracking,
shipping-rate calculation, destination eligibility, safe packaging/transport and
dispatch-to-arrival estimation are not verified by this application. Local
preorder payments and delivery/collection progress remain available as before.

## Data and release

No new database migration or production data maintenance is required. The optional
fields use the existing `Product.selling_details` column from migration 0021:

```json
{
  "ordering_mode": "shipping_enquiry",
  "dispatch_from": "2026-12-01",
  "dispatch_through": "2026-12-31",
  "shipping_note": "Agree destination, courier and fees before paying."
}
```

Omission defaults to local ordering. Dispatch dates are paired ISO dates, ordered
start ≤ end, spanning at most 365 days; enquiry mode requires them. Notes are at
most 300 characters. Staff-only product validation serializes dates to JSON
strings. A supplied selling-details document still replaces the whole document.
Previous accepted selling terms and recipes remain snapshots.

Verify locally with isolated fixtures, then publish the same tested commit to
main and integration. No live customer orders, statuses, payments or inventory
are changed by implementing or testing this batch. Automated checks supplement
owner interviews and usability sessions; they establish no conversion uplift,
food safety or real-customer forecast accuracy.

## Verification

- Full backend suite: 619 tests, passing with 11 skips in isolated SQLite.
  Nine skipped checks require PostgreSQL row locks; two require the provisioned
  Genpact model bundle. This batch changes neither locking nor model artifacts.
- Frontend utility, planner, UX, checkout, recommendations, shopping, predictive,
  PayPal and escrow regressions passed. Changed-source ESLint passed for 31 files,
  and the production build succeeded. Full-repository lint still has the two
  previously recorded errors in unchanged CostPanel.jsx and useOrderCatalogue.js.
- Twenty-two browser/accessibility checks exercised owner offer editing,
  catalogue/detail/contact, ordinary collection checkout, run grouping, packing,
  collection progress and financial queues. Four further checks covered the
  final compact board and dispatch/date labels. Widths included 1440, 768, 390
  and 320 pixels. No automated WCAG A/AA violations, document overflow or page
  errors were found; mobile and desktop screenshots were inspected.
- Django system checks and migration consistency passed: no migration generated.
  No real provider payment, customer message, courier booking or production data
  update was performed. Vercel deployment readiness must be checked separately.
