# Stage 9: inventory attention list

Inventory now highlights non-empty batches on hold, past their recorded expiry, expiring today, expiring in 1–3 days, or missing expiry information. Groups have mutually exclusive priority: held batches are counted only under On hold in this panel. Within each group, batches sort by expiry date and ID. Review batch opens the existing version-protected batch editor using the current loaded record.

Recorded stock value is remaining quantity multiplied by batch unit cost, summed per group. Missing cost coverage is reported explicitly; zero is a valid recorded cost. These are approximate displayed monetary values, not accounting postings, measured waste, or claimed savings. Ingredient quantities with different units are never summed.

The inventory table, filters and summary now use an explicit Malaysia calendar date. The date updates once per minute while the page is open; stock records retain the existing loading/refresh behavior. Empty batches no longer inflate the Expiring Soon and Expired summary counts. Summary counts can include held stock; the attention panel states its separate held-first grouping policy.

No migration or backend changes. This supports objective 2 through clearer shelf-life monitoring and objective 4 through recorded cost exposure. It does not assess food safety or automatically approve stock, alter expiry dates, dispose of batches, or change order allocations.

Validation: all 26 frontend utility tests passed, including Malaysia date boundaries, empty-stock exclusion, held/expired overlap, cost coverage and ordering. New module lint, production build and diff checks passed. Browser interaction and visual layout remain unverified.
