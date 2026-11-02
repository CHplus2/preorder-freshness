# Current client workflow — 3 November 2026

This guide describes `main` after the five client-feedback batches. The FYP
report and frozen integration branch describe the earlier implementation.
See [the feature mapping](client-fyp-feature-map.md) before revising the report.

## Owner: prepare the kitchen for orders

1. Sign in with a staff account. Customers do not use this sign-in form.
2. In **Settings**, save the kitchen identity and contact information. Under
   **Collection & delivery**, set delivery areas and the fee charged for each.
   These are your prices, not live GrabExpress quotations. The default morning
   delivery window is **7:30 am–11:00 am Malaysia time**; hours remain editable.
3. To offer pickup, enter the collection location and use **Enable pickup**.
   Saving an address alone does not enable it. Review collection hours too.
4. Configure the receiving QR using a local image upload/crop or an image URL.
   Verify the receiving details with the bank. Cropping a printed heading does
   not conceal the recipient name shown by the banking app.
5. Create menus with prices, categories, selling units and ingredient recipes.
   One selling unit can be a meal, box or pack. Configure offered weekdays/dates
   and cutoffs where needed. New orders do not require cooking-step schedules,
   equipment reservations or a Planner confirmation.
6. In **Inventory**, record actual received batches and their storage/date
   evidence. Held, expired and future-receipt batches cannot cover new orders.
   Allocated ingredients must also cover the selected handover date. Stock that
   you intend to buy later is not yet received stock.
7. In **Packaging**, add containers, lids, bags or labels and their piece counts.
   Use **Menu packaging** to map pieces per selling unit. Record later receipts
   or adjustments with a reason; use **History** to review movements.

Menus need valid ingredient recipes and sufficient eligible ingredient stock.
Packaging mapped to a menu also needs enough pieces. A menu without a packaging
mapping has no invented physical packaging requirement; configure mappings to
track the packaging actually used.

## Owner: record ingredient shelf life

- **Use a package date:** enter the printed expiry/use-by or best-before date
  and its meaning. Manufacture and purchase dates are different fields.
- **Calculate from received date:** for unlabelled ingredients, enter documented
  storage days and a source matching the ingredient's actual conditions. Receipt
  is when this batch reached you; it does not establish its earlier age or
  handling. Optional guidance saved with the raw material can be applied when
  storage conditions match, or the batch can have its own documented values.
- **Calculate from manufacture date:** use a known manufacture date and documented
  shelf life. Do not treat a manufacture date as a printed expiry.
- Record opening/thawing limits when relevant. The earliest applicable recorded
  deadline limits allocation. Uncertain handling or a known storage breach holds
  the batch until reviewed.

The FoodSafety.gov link is a general reference, not automatic verification of
an ingredient's shelf life. Date indicators and remaining-life percentages use
recorded dates and conditions. They do not measure physical freshness, pathogens
or actual temperature; a best-before quality date is treated conservatively as
a stock-planning cutoff.

## Customer: place a preorder

1. Browse, search or filter the menu. **Recommended for you** offers a small
   discovery set. The optional date/quantity/budget finder can suggest one menu
   or mixed-menu alternatives. A budget concerns the whole suggested quantity,
   not a price to multiply again. Checkout prices the final basket.
2. Add food and review the basket. Select delivery or enabled self-collection.
   Pickup has no delivery fee; delivery uses the selected area's saved fee.
3. In checkout, enter **name and phone**. Delivery also needs a full address.
   Email, customer registration and a password are not required. Staff accounts
   still require authentication.
4. Choose the delivery/collection date and time. The system checks offered menu
   dates, hours, cutoffs and recorded stock. It does not calculate cooking start
   and end times. Optional handover notes do not authorise unattended delivery.
5. **Delivery:** choose QR or cash. **Self-collection:** QR only. Cash means an
   arrangement with the kitchen; it does not make a courier collect money.
6. For QR, pay the displayed amount in the banking app and upload a JPG, PNG or
   WebP receipt (up to 4 MB). An uploaded image is evidence awaiting verification,
   not an automatic paid status. PDF proof is not supported.
7. Submit once and check **My orders**. Stock and packaging are deducted during
   successful placement, not when adding food or uploading a receipt. Checkout
   rechecks availability; a shortage preserves the basket and rolls back the
   attempted order and stock changes. Repeating the same checkout request does
   not deduct stock twice.

If you have already paid and checkout details change, **do not pay again**.
Keep the receipt and contact the kitchen about a changed amount or an order that
cannot complete. A receipt uploaded earlier in the same checkout produces a
warning when its accepted details are no longer current. The same unsubmitted
image can be uploaded for updated details, subject to validation; an image already
submitted to another order is rejected. The app cannot reverse an external bank
transfer automatically.

Order history belongs to the current private browser session (up to 30 days).
Save the order number. Another device or cleared browser data does not recover
orders merely by entering the same name or phone. Contact the kitchen instead.
Customer receipt images are accessible only to their session and staff.

## Owner: payments and actual handover

1. Open **Orders**. New orders start **Not received**. Review the accepted time,
   customer details and payment status. The order number links the record to its
   stock and packaging movements.
2. For QR, open **Payment records → Review customer payment proof**, verify the
   full transfer against bank records, then record the verified reference. For
   cash, record payment only after actually collecting it. Uploading evidence or
   marking food received does not record a payment.
3. Arrange delivery directly with the customer/rider. Courier reference and
   tracking link entry remains manual. No GrabExpress API, automatic booking or
   verified courier-event integration is configured. The system does not infer
   handover from a clock. Use the recorded phone or copy the prepared order
   message; only use the customer's agreed contact channel.
4. After actual collection/receipt, choose **Mark received**, or select up to
   20 eligible orders and **Mark selected received**. Correct a mistaken receipt
   with a reason. These actions do not take payment or deduct stock again.
5. A delivery-time change uses the accepted order terms and checks the allocated
   batch deadlines. There is no separate cooking-plan approval for a new order.
6. Cancellation is a separate exception. Confirm unused ingredient/packaging
   returns only when they are actually unused and suitable for stock. A refund
   is recorded separately after funds are returned externally; it does not
   automatically restock prepared food.

New guest orders do not collect email or enrol the customer in email reminders.
Historical account opt-ins and owner reminder infrastructure remain, but this
review did not send live email or change a scheduler. Phone contact is not an
automatic WhatsApp/SMS subscription.

## Owner: daily summaries, printouts and sales

- **Sales → Daily order summary:** choose a Malaysia delivery/collection date.
  See menu-unit totals and individual orders. Cancelled orders and generated
  sales-history summaries are excluded. Totals cover all matching active orders,
  not just the current 50-order page. Order value can include unpaid orders.
- **Print order slip:** available from each order or daily summary. Includes
  accepted name, address/collection location, phone, menus, quantities and totals.
  Use **Print / Save PDF** for the browser print dialog and A4 output. A slip is
  not proof of payment. Keep printed customer details private.
- **Sales by delivery date:** select 1–366 days. Sales include recorded paid,
  received orders only, with net food and delivery income separate. Refunded,
  cancelled and unpaid orders do not contribute. Generated history, demo-wallet
  credits and documented fictional/Sandbox/test-network receipts are excluded.
  Missing handover dates are reported separately, not guessed.
- Download the sales CSV when the complete menu breakdown is available.
  Menu totals use accepted unit prices before order-level discounts; net food
  totals already include discounts. Neither total is profit or bank reconciliation.
- **Historical analytics, forecasts & costs** retains earlier analysis definitions
  and loads on demand. FreshCast's evaluated-model demo remains separate from
  this kitchen's recorded sales; no model was trained by these client changes.

## Release and acceptance

Existing database updates **0024–0026** are required and were confirmed by the
owner. Batches 4–5 add no migration. All new source releases use **main only**;
integration and the FYP document branch remain unchanged.

Automated and browser evidence is in
[the final review evidence](evidence/20261103-client-review/README.md).
It demonstrates functional checks on isolated data, not client sign-off, real
payment settlement, email delivery, food safety or a measured conversion gain.
