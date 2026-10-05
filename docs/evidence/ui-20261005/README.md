# Planner and sales hierarchy — 5 October 2026

Local browser review using isolated synthetic data and owner account. Production records unchanged.

- Replaced the two planner setup alert boxes with neutral rows, short descriptions and separated actions. Singular/plural counts are handled. Preparation link points to the existing preparation review mode. Review orders was clicked and focused `planner-order-1`.
- Removed ledger counts from disclosure titles for consistency. Empty-state explanations remain inside; final browser snapshot confirmed titles are Expense ledger and Wastage ledger.
- Sales contribution values now use labelled fields. Definition and missing-cost details remain available in disclosures. Recorded ingredient use is a 14px subheading with an explicit empty message. Accepted-recipe headings in owner order cards use the same size.
- Desktop planner and contribution layouts inspected; planner and contribution also inspected at 390px. Removed duplicate dividers discovered during review. Final desktop screenshot reflects the divider correction. Viewport restored afterward.
- ESLint and build passed. Final CSS-only correction rebuilt successfully. No backend calculations, accounting rules or database migrations changed. This targeted review does not certify every screen or replace participant usability evaluation.

Evidence: [planner](planner.png), [narrow planner](planner-mobile.png), [sales order breakdown](contribution.png).
