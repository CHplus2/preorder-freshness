# Batch 3 — daily summaries, print previews and sales

5 November 2026, `main`, following `9c7a5ba`. No migration, model, production
database, scheduler or bank configuration change. Test orders and customer names
are isolated fixtures; the payment-recording call simulates staff verification,
not an actual transfer. No email, money or courier request was sent. Publication
and Vercel deployment success remain separate checks.

## Changes and checks

- Daily summary has All / Not received / Received filters with whole-day counts.
  The selected view controls order rows, menu quantities, amounts and pagination;
  the date/filter survive URL navigation. The default remains All orders.
- Report/print views refresh on return after order updates in another tab.
  Pending/error reads hide old figures/exports and disable printing. Strict response
  readers reject invalid dates, duplicate rows and inconsistent money totals.
- Delivery slips label manual payment QR / bank transfer; pickup retains its
  QR label and collection location. Printing remains an explicit action after
  preview. Loaded time is shown on screen, not in the print toolbar output.

Backend: **23 tests passed** across client reports and the integrated client
journey. These cover Malaysia date boundaries, filters, accepted contact/price
snapshots, CSV safety, permissions, pagination, read-only stock/payment records
and bounded query counts. The report query-count assertion remains at most ten
and does not grow per order or join payment-proof bytes. No new PostgreSQL
concurrency claims are made by this report review.

Frontend report/operational tests, changed-file ESLint and production build passed.
The existing Vite main-chunk size advisory remains.

## Browser/PDF evidence

Chromium with built assets and a local Django server passed **15 journey checks**
with no uncaught page errors. The fixture has three non-cancelled same-day
orders: two meals not received, one paid/received pickup meal, and one
unpaid/received delivery meal. Cancelled, next-day and undated orders also test
scope. The pending order has actual isolated ingredient/packaging allocations so
its later receipt transition uses the normal stock prerequisite.

- All orders: four selling units and RM63 order value; Not received: two units
  and RM34; Received: two units and RM29. The list and menu totals match each
  selected scope. Date changes preserve the selected receipt filter.
- The individual preview contains the saved customer name, phone, address and
  accepted item price. It does not automatically print. Pickup shows collection
  location and omits the saved delivery address.
- Generated PDF: **one A4 page** with required name/phone/address/menu/total text,
  no print buttons or kitchen navigation, and text blocks within the page width.
- Initial paid-and-received sales: RM12. After the allocated pending order is
  marked received and its payment recorded locally, sales refresh to **RM46**:
  RM36 food plus RM10 delivery. The remaining unpaid received order is excluded.
  Downloaded CSV matches the visible amounts.
- Returning to the print preview refreshes receipt/payment status. Corrupt
  report totals hide totals/export and offer retry; retry restores the report.
  Anonymous print access is denied without exposing the fixture customer's name.
  Stock quantities are identical before/after the report/print/receipt/payment
  journey. Mobile daily, sales and slip screens have no horizontal overflow.

Screenshots are local fixture captures. Daily/print section captures can include
content beyond one viewport; mobile page captures use 390 × 844.

- [Daily summary](desktop-daily-summary.png)
- [Mobile daily summary](mobile-daily-summary.png)
- [Mobile order slip](mobile-order-slip.png)
- [Mobile sales](mobile-sales-report.png)
- [Rendered A4 preview](a4-order-slip-preview.png)
- [Fixture PDF](fixture-order-slip.pdf)
