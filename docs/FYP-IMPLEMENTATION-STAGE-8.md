# Stage 8: daily packing list

The owner's Planner now includes a Packing list tab for the selected Malaysia delivery date. It shows menu portion totals and each order's accepted item names and quantities, delivery time, status, delivery method and payment status. Paper checkboxes support quantity and label checks before dispatch.

Only pending, processing and cooked orders are included. Shipped, delivered and cancelled orders are excluded. Missing or invalid delivery dates are counted separately so they do not silently disappear. Totals do not merge preparation tasks or change accepted recipes. Renamed menus and deleted menu records are kept separate when aggregating.

Print uses a dedicated sheet containing no customer addresses, phone numbers or usernames. Printing is disabled while refreshing or after a refresh error. The sheet includes a generation time and warns that copies may become outdated. Paper checkmarks are not persisted and do not change order status. Use All Orders to record dispatch.

No database migration or new API is required; the module uses the existing owner-only planning response. This strengthens the operational workflow under objective 1. Reduced packing mistakes and time savings are evaluation hypotheses, not measured outcomes.

Validation: 22 frontend utility tests passed, including Malaysia midnight boundaries, status exclusions, multiple order lines, missing dates, stable ordering and deleted menu records. Production build passed. Physical printing, print preview and the owner browser journey have not been verified.
