# Mobile reports and read-only recovery — 7 October 2026

Isolated SQLite review data at localhost:8024; synthetic owner session; mobile viewport 390 × 844. No live data changes, payments or report exports were submitted.

## Changes

Added readApiError for read-only reporting failures. Sales, recommendation engagement, contribution loading/export, batch tracing, pricing previews and cost-report loading now give retry guidance without unrelated order-submission warnings. Cost mutations retain their existing mutation error handler. Authentication, throttling, field validation and server reference handling are preserved; server internals are not displayed.

## Actual validation

- Six apiError unit tests passed, covering read-only network/timeout/invalid responses/server errors, safe fallbacks, validation, authentication, throttling, and preservation of existing mutation warnings.
- ESLint and production build passed.
- At mobile width, expense and wastage disclosures opened. The empty expense ledger explained that no expenses were recorded; recorded wastage was RM 0.20 in the synthetic fixture. Document width did not exceed the viewport.
- Expanded cooked order #4: RM 2.00 ingredient cost, RM 0.50 packaging estimate, unavailable contribution and recorded ingredient use were readable. The smaller ingredient subheading and vertical spacing fit the screen (contribution.png). This is not a paid or profitable order claim.
- Stopped only the isolated server, then refreshed sales, recommendations and contribution. Three read-only connection messages appeared; all four sales summaries showed Unavailable; contribution and engagement export buttons were absent (recovery.png).
- Restored the server. Contribution returned after retry. An immediate combined observation still showed one alert and no engagement export; a fresh page load then showed zero alerts and both exports. Therefore this batch confirms page-load recovery, not completion of every individual retry before navigation.
- Restored viewport and closed temporary browser tabs.

These are targeted browser checks, not a full system rerun, real participant evaluation, production verification or proof of conversion uplift. Cost-report refresh fault injection and all screen sizes remain outside this batch.
