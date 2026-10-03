# Stage 13: recommendation evidence export

Sales > Recommendation engagement now offers Download engagement CSV. The file exports the response currently displayed, without a second request that could produce different figures. Refresh the report to obtain newer figures before exporting.

Each variant row includes the server-generated timestamp, inclusive rolling 28-day request window, current experiment setting, exposure/click/basket/order/paid counts, percentages of exposed requests, attribution definition and interpretation notes. Timestamps retain their UTC offsets; the on-screen generation time uses Malaysia time. An empty cohort exports metadata with a `no_exposures` row and blank measures. Missing measures remain blank; observed zero remains zero.

The CSV contains only aggregate metrics, has UTF-8 BOM and quoted fields for spreadsheet compatibility, and neutralises formula-like text. No customer details, migration, live record changes or experiment configuration changes are involved.

Use dated exports as evaluation evidence. Overlapping rolling windows are not independent study groups. Counts reflect observations during report generation, not an immutable database snapshot: recent requests may still convert and payment updates may change outcomes. Current experiment mode does not identify the mode of every historical request. These reports alone cannot demonstrate causal conversion lift or reduced decision fatigue.

Validation: 38 frontend utility tests (including four export cases) and 23 isolated SQLite commitment tests passed. The API test verifies an exact 28-day window and matching generation/end timestamps. Targeted lint and production build were checked. Browser download interaction and spreadsheet-application rendering have not been manually verified.
