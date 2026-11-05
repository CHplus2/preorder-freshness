# Wrap & Bowl operations — verification, 6 November 2026

Real local browser captures of the changed application after applying the exact
release SQL to disposable PostgreSQL 16 fixtures. Desktop: 1366 × 1000; mobile:
390 × 844, browser locale en-MY. Names, addresses, receipts, stock and orders are
fixtures, not customer transactions. No production database, bank transfer,
email or courier API was contacted.

- [Current stock and targets](desktop-current-stock.png): 25 non-empty current
  ingredient batches, a dated ten-per-menu requirement check and safe worksheet.
  Hovered primary-button contrast was explicitly verified.
- [Targeted packaging](desktop-targeted-packaging.png): the stock-check link
  targets one supply; recording two received pieces changes its saved balance.
- [Refreshed history](desktop-refreshed-orders.png): current menus, local handover
  terms and available payment methods, without new demo labels.
- [Mobile stock check](mobile-stock-check.png): no horizontal document overflow;
  the wider table scrolls within its container.
- [New checkout](desktop-kuching-checkout.png) and [new order](desktop-new-customer-order.png):
  a new virtual-authenticator passkey account, twelve local areas, RM13 food plus
  RM8 delivery and a 07:30 handover. The final order contains the chosen food and
  unpaid cash status. Exact per-ingredient quantities and four packaging pieces
  were deducted once, including a replay of the original request.
- [Browser results](browser-results.json): 5 completed journey checks, zero
  uncaught page errors. The reset itself was applied through the default file,
  not by injecting a test-only ready flag.

## Automated checks

[PostgreSQL regression](postgres-regression.txt): **149 tests passed**, covering
SQL replacement, stock checks, packaging, checkout, reports, reminder activity,
forecast provenance, expiry evidence and real placement locks. No skips.

[Final SQL/stock check](postgres-final-sql.txt): **16 tests passed** after release
validation was enabled and the test-only guard override removed. This includes a
late constraint failure rolling back the whole replacement, private original
receipt retention, oversized/empty historical orders, cancelled packaging terms,
repeat-after-consumption protection, and a new checkout after replacement. No
skips. The user lookup does not assume the schema containing Django's auth table.

[Frontend stock checks](frontend-stock.txt), [checkout/area checks](frontend-checkout.txt),
packaging utility tests, changed-component ESLint and production build passed.
Existing large-main-chunk advisory remains. These are implementation checks, not
client user-study results or evidence of genuine sales/model accuracy.

## Application limits

The owner explicitly confirmed all affected operational data fictional and
requested its replacement. The generated planning quantities/deadlines are not
verified physical inventory or shelf-life guidance. The private recovery archive
preserves original operational data and provider references, while current UI
records describe the refreshed project scenario. Existing receipt images are
retained privately and are not attached as proof for different order totals.
Model artifacts/training, account/passkey credentials and bank/QR configuration
were not changed. Generated-history provenance remains available to forecasts.

The script is **not a normal build/release step**. The owner must run batch 1
first, then the coordinated operations SQL in Supabase. No schema migration or
RLS/trigger disabling is required. Successful local verification and source
publication do not prove a Vercel Ready deployment or live Supabase application.
