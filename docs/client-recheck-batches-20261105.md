# Client workflow recheck — 5 November 2026

All work and publication use `main`. The FYP/integration branches stay frozen.
This document distinguishes source behaviour from the deployed site. The earlier
checkout/access correction `1247bc4` was still one commit ahead of origin/main
when this recheck began; its push had been cancelled. Reading the production
storefront through this environment was denied by the network proxy, so live
receiving details, fees and deployment success have not been inspected here.

## Batch 1 — account entry, fees and receiving payments

- Header Account, the checkout account gate and a direct `/account` visit open
  the customer modal. Closing it leaves a compact page with a reopen button.
  There is no second inline registration form. Existing customers switch to
  passkey sign-in. Customer details remain the previously confirmed name/phone;
  the passkey authenticates them without email, password or SMS. Staff use their
  existing protected credentials through a visible staff link.
- Simple-mode staff Account now shows staff profile, kitchen reminder settings
  and collapsed optional sign-in-email/recovery controls. Customer address forms
  and customer-reminder subscription copy are removed from that staff view.
- A sign-in email is not the SMTP sender or owner-reminder recipient. Account
  email edits do not change those settings. The kitchen reminder card links to
  Settings → Email reminders, where the configured recipient/test/activity are
  shown. No scheduler or live sending configuration was changed in this batch.
- The basket shows food totals only. Method, area and date/time are chosen once
  at checkout. A matching server quote is required before receiving details,
  receipt submission and placement; fee changes refresh the total while keeping
  the chosen time. The receiving QR/bank choice is initially selected when
  configured. Receipt evidence remains private and does not mark payment paid.
- A saved free-delivery promotion can waive even a nonzero area fee. Checkout
  now names the selected area, shows its usual fee and explains the threshold
  that waived it. No saved promotion or accepted order has been silently changed.
  To charge the area fee on every delivery, turn off **Offer free delivery above
  a food subtotal** and save **Delivery areas & fees**.
- QR/bank details are owner configuration, not source-code defaults. Settings →
  **QR & bank transfer** needs a saved receiving QR and/or bank instructions plus
  its enable switch. Delivery accepts configured QR/bank transfer or cash;
  self-collection still requires a QR image. A stock or time failure blocks
  payment, rather than asking a customer to pay for an unavailable order.

No schema migration, production stock write, bank transfer, email send or model
change is required by these UI corrections. Existing migration 0027 remains a
prerequisite for passkey accounts; the owner previously reported applying it.

## Remaining review batches

These features already exist in source. The remaining work is focused UI and
integration review, not a claim that they are visible on the current deployment.

| Review batch | Client requirement | Source entry and relevant verification |
| --- | --- | --- |
| 2: stock and packaging | Packaging stock page/tracker, menu packaging and automatic ingredient/packaging deduction when placing an order | `/admin/packaging`; `test_packaging_stock`, `test_simple_ordering`, `test_client_journey`; quotes read only, placement transactional and retry-safe |
| 3: daily work and reports | Order/item quantities per date, per-order print preview with name/address/phone, sales reporting, received/not received | Orders → Daily summary; `/admin/orders/:id/print`; Sales by date; `test_client_reports`, `test_client_journey`; payment and actual receipt are separate facts |
| 4: delivery/settings and final journey | Area fee editor, 07:30–11:00 Malaysia hours, collection QR-only, delivery QR/cash, no cooking Planner/rules, owner delivery reminders | Simple ordering/guest tests, Settings, current owner reminder worker; final customer/owner mobile review and production release verification |

The agreed end time is **11:00 am**, correcting the original “11 pm” note. New
simple-mode orders use dated fulfilment and stock availability without cooking
capacity reservations. The old scheduling implementation remains for historical
compatibility; it is excluded from the simple ordering workspace. Receiving an
order does not itself verify a bank payment or re-deduct stock.

The [FYP feature map](client-fyp-feature-map.md) retains the five objectives and
maps the implemented features to source evidence. This review does not rewrite
the marked report or invent client evaluation results.
