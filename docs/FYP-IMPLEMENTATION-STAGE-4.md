# Stage 4: downloadable contribution reports

Implemented 30 September 2026. Single-vendor scope remains unchanged.

## Delivered

In owner Reports, apply an order-placement date range in **Order contribution and recommendation outcomes**, then choose **Download contribution CSV**. The export uses the applied report dates, not unsaved date inputs.

- Exports all matching orders, including rows beyond the dashboard's latest-200 display. Ranges over 5,000 orders are rejected with a request to narrow the dates; no silent truncation.
- Uses the same contribution calculation and date validation as the dashboard. The inclusive order-placement range can span at most 367 days.
- Includes order ID, placement/delivery timestamps with Malaysia timezone offset, statuses, realised flag, MYR currency, food revenue, known cost subtotals, contribution and missing-data reasons.
- Unknown/unrealised contribution remains blank. Known cost subtotals are explicitly labelled as subtotals; they are not proof that all costs were captured.
- Includes cohort dates and calculation limitations per row. Food contribution excludes delivery, fees, labour and overhead; packaging is an accepted estimate. It is not net profit.
- Does not include customer names, emails, addresses or phone numbers.
- Requires owner/staff access, sends private/no-store cache headers, supports Unicode via UTF-8 BOM, and escapes formula-like owner-entered text. Negative numeric contribution remains numeric.
- The downloaded values reflect the records read at export time. Concurrent business changes can produce differences from an earlier dashboard load; this is not an immutable accounting-period snapshot.

No additional schema migration is required. Stage 1 migrations remain required before deploying the combined changes.

## Verification

- Full isolated SQLite backend suite: **140 tests discovered, 139 passed, 1 PostgreSQL-only test skipped**.
- Seven export tests cover permissions, empty files/headers, more than 200 rows, rejection above 5,000, date selection/validation, Unicode-compatible CSV quoting and formula protection, missing data, actual contribution parity and cooked cancellation losses.
- All 10 frontend utility tests and targeted ESLint for `OutcomePanel.jsx` passed.
- Production build passed. Browser download interaction and opening the CSV in a spreadsheet application remain unverified.

Manual acceptance: export a range from Reports, open the downloaded CSV, compare a completed order with its dashboard details, check a missing-cost order stays blank, and verify changing the draft date inputs does not change export dates until Apply is selected.

## Local preview branding correction

The browser previously displayed `Dapur Kita Review Kitchen`, a synthetic name in an isolated temporary SQLite database used for browser checks. That server had stopped and the tab retained its old page. The temporary record was restored to `Dapur Kita`, the isolated server restarted, and the refreshed browser title/header verified. Production branding/data was not changed. The local preview still contains synthetic sample menus and accounts; it is not a copy of the live store.
