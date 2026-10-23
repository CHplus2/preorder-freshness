# Home-food case study — batch 2

This batch supports owner delivery, express requests and self-collection without
changing recipes, inventory policies, FreshCast models or payment verification.
The Facebook examples identify workflow differences; no real seller contacts or
offers are copied into the store. Production settings and order records are not
seeded or changed by this implementation.

## Owner setup

Open **Settings → Collection & delivery**.

- Enable delivery and/or self-collection. Both off pauses new checkout, while
  retaining existing orders. Defaults preserve owner delivery and leave pickup
  off until the owner supplies a location.
- Choose separate integer-hour handover windows, inclusive at the closing hour.
  **Delivery 9–12** accepts delivery at 12:00 but not 12:01. **Collection 7–14**
  accepts collection between 7am and 2pm. These are Malaysia times. Kitchen
  preparation hours remain independent; food may finish before delivery closes.
- Enter the collection location and optional instructions. Enabled pickup makes
  these public. Disabling pickup hides them from public settings, but retains
  them for the owner and customers with accepted order snapshots.
- Optionally list delivery areas, one per line (up to 30 unique names). Customers
  must declare one at checkout. This is not geocoding, postcode validation or a
  guarantee that their address is in the selected area. An empty list keeps the
  previous unrestricted-area behaviour. The existing `service_area` description
  remains branding/contact copy rather than an enforced zone.
- Configure the delivery fee and optional free-delivery threshold. The threshold
  uses the food subtotal before discounts. Blank means no free-delivery threshold;
  a zero fee means free delivery. Defaults remain RM5 below an RM50 food subtotal.

Collection has zero delivery fee and zero travel buffer. The existing travel
buffer applies only to deliveries. Recipe advance notice, batches, resource
bookings, menu weekdays/dates/cutoffs, finish allowances and daily limits still
apply to both methods. A 7am collection may require permitted previous-day work;
enabling pickup does not automatically permit overnight food holding or make a
physically impossible recipe fit. Owners must configure real handling limits.

## Customer and owner journeys

Cart and checkout share a remembered fulfilment choice for the current account.
Switching method invalidates old time suggestions and updates the fee. Delivery
requires the customer's saved address and a configured area when applicable.
Collection requires neither an address nor a delivery-area choice. Time searches,
date recommendations, quotes and checkout use the chosen method's hours/buffer.
Only the server's final locked checkout establishes the order and its amount.

Express remains a **request** for the owner to arrange. Nothing books a Grab
service or guarantees a courier, faster cooking or a transport price. Delivery
areas and fees apply to express requests too; any extra arrangement must be
agreed with the customer before collecting additional money.

An order saves its method, area/location, instructions, handover hours and travel
buffer in `fulfilment_snapshot`. Its charged fee is retained in `shipping_fee`.
Later settings changes do not silently move the collection point, change the
fee or introduce a travel buffer. Automatic/manual replanning and customer date
changes use accepted handover terms; kitchen working hours and current daily
capacity still constrain new plans. This batch does not provide an automatic
switch of an accepted order from delivery to pickup or silently adopt new
handover terms. A separately agreed amendment flow is future work.

Customer receipts/progress, owner order management, Planner, packing lists and
calendar reminders identify collection. Owners mark **food ready** (deducting
ingredients once), then **collected** after handover. There is no pickup dispatch
stage. The stored completed status remains `delivered` for compatibility with
sales analytics, reviews and FreshCast paid-history processing. For pickup,
`delivery_at` is the agreed collection time; forecasts still group by that local
fulfilment date, not the date the order was placed. Payment remains independent
of cooking and collection status.

Cash at collection, manual transfer, PayPal Sandbox and the demo credit wallet
remain available under their existing configuration. Wallet and PayPal amounts
exclude delivery fees for pickup. The existing escrow contract uses a dispatch
lifecycle, so order-linked escrow is explicitly limited to delivery orders;
it is not presented as pickup protection. Delivery escrow and the standalone
Sepolia demonstration are preserved. No real payment was made during testing.

## Release

Migration **0020_fulfilment_options** adds store controls, accepted-order
fulfilment snapshots and the pickup method. Existing order methods/amounts and
store delivery defaults are retained; no real collection address is invented.

After a private backup, from the connected Windows project terminal:

```powershell
git pull --ff-only
.\backend\venv\Scripts\python.exe backend/manage.py migrate
```

Then redeploy Vercel. Use the existing connected `DATABASE_URL` and
`DATABASE_SCHEMA=django_app`; do not commit either value. The Vercel build's
existing release check requires migration before the new application can serve
the schema. The coding workspace does not apply the production migration.

## Verification

Backend regressions cover defaults, early pickup, lunch windows, unavailable
methods, address ownership, declared areas, custom fees, free thresholds,
idempotent checkout, stock allocation, shared equipment, accepted-term replanning,
customer rescheduling, owner-only configuration and hidden inactive pickup
locations. Provider doubles verify pickup PayPal capture and food-only wallet
debits. Existing delivery/payment/forecast tests remain in the regression set.

Browser verification uses an isolated SQLite database and fictional local
accounts. It exercises owner settings, a buyer with **no address**, 7am pickup,
cash ordering, owner ready/collected actions, and the address-free demo-wallet
flow. Responsive/accessibility scans and screenshots cover desktop, tablet and
phone widths. Automated checks supplement rather than replace testing with home
food operators. They do not establish production deployment readiness.

Completed checks: **217 backend tests**, frontend utilities, checkout, UX,
recommendations, shopping, Planner, PayPal and escrow regressions, changed-source
lint, migration consistency and a production build. **22 browser scans** at
1440, 768, 390 and 320 pixels reported no page errors, document overflow or
automated WCAG A/AA violations after fixing small-text contrast and the four-stage
collection layout. No model training or model-accuracy evaluation was performed.

Next: explicit selling units, sizes/servings and fixed pack contents. See the
[case-study roadmap](HOME-FOOD-CASE-STUDY.md) for seasonal dispatch and further
operator workflows.
