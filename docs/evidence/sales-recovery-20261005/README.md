# Sales summary recovery — 5 October 2026

Scope: main sales summary, seven-day chart, menu performance and forecast. Independent contribution, recommendation and cost panels retain their separate refresh flows.

Added response validation for required summary fields and sales rows. Missing/null monetary values are rejected; valid zero sales and null forecasts (insufficient history) remain distinct. Requests are cancelled on unmount. Refresh clears previous results and rendering is gated on successful validation, so a failed refresh cannot display stale chart rows as current data.

Verification: frontend npm test, ESLint and production build passed. New validator tests exercise missing fields, malformed lists, null amounts, booleans, nonfinite/negative numbers, zero values and unknown forecast history.

In the browser, loaded the isolated synthetic owner sales page, stopped only the test Django server, and clicked Refresh sales. All four metrics showed Unavailable; daily sales, menu performance and forecast showed recovery text instead of previous rows. Restarted the server and clicked Refresh sales: valid zero-sales results and Insufficient history returned. [Failure state screenshot](unavailable.png).

Tests used the explicit temporary SQLite database with dotenv disabled. No production records changed. Malformed payloads were tested at the validator level, not injected into the browser. This is targeted verification rather than an exhaustive dashboard audit.
