# Stage 6: consolidated shopping needs

Planner → Shopping combines existing per-order ingredient shortfalls by material ID and inventory unit for the selected date, including overdue requirements. Each ingredient shows its total quantity, earliest needed date, order count and expandable per-order breakdown. Different materials/units remain separate. The underlying accepted-recipe and stock allocation rules are unchanged.

Missing accepted recipes remain visibly flagged; an empty result does not prove those orders are covered. Shopping totals do not reserve stock or record purchases. Owners should buy in stages where dates differ, check batch dates through preparation, record receipts in Inventory, and refresh the planner.

Verified: 43 backend planning/commitment tests, 14 frontend utility tests (four new shopping aggregation cases), targeted lint and production build passed. Browser interaction remains unverified. No database migration is required.
