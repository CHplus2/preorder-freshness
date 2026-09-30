# Stage 5: pricing and bulk-discount simulator

Implemented 30 September 2026. Single-vendor scope is unchanged.

## Delivered

Owner Reports → Costs, wastage and pricing now includes **Test a price or bulk offer**. Select a menu, portions, proposed price, discount, ingredient-cost increase and optional additional cost per portion. Compare the current offer with the scenario without updating products or storefront promotions.

- Baseline uses the current menu price and current bulk discount only when the selected quantity reaches the configured minimum.
- The scenario's discount applies to the whole simulated single-menu order regardless of the current bulk minimum. The form supports the same maximum 50% discount as store settings.
- Ingredient inflation affects scenario ingredients only. Packaging stays at its current estimate. Additional per-portion cost is applied to both comparisons for a consistent baseline.
- Results include food revenue after discount, ingredient/packaging/other costs, order and per-portion contribution, margin, change in contribution, and the estimated price required to cover the entered costs at that discount.
- The cost-covering price rounds upward to the next cent. It is an estimate from entered costs, not a recommended market price.
- Missing recipe, invalid recipe quantities, missing ingredient estimates or missing packaging keep contribution, margin and cost-covering price unavailable. Explicit zero costs remain valid.
- Below-cost scenarios are flagged. Neither sales demand nor scheduling capacity is predicted.
- Editing scenario inputs clears the previous result. Saving costs through the surrounding cost panel remounts the simulator so the old scenario is cleared. Recalculate after changes made elsewhere.

The staff-only POST endpoint validates finite decimal amounts and bounded quantities/percentages. It writes no database records and never changes checkout pricing. Results exclude unentered waste, delivery, fees, labour and overhead; they are not net profit. Additional costs are manual assumptions, not an automatic allocation of the expense ledger.

## Verification

- Full isolated SQLite suite: **148 tests discovered, 147 passed, 1 PostgreSQL-only test skipped**.
- Eight new tests cover calculations, no mutation, bulk eligibility, unknown costs, missing/invalid recipes, explicit zero costs, negative contributions, currency rounding, permissions and invalid inputs.
- All 10 frontend utility tests passed. Targeted ESLint passed for the new simulator component.
- Production frontend build and `git diff --check` passed.
- No new schema migration. Existing Stage 1 migrations remain required.
- Browser interaction remains unverified. Manual check: compare a known recipe, test a below-cost discount, remove an ingredient cost and verify unavailable results, and confirm the live menu price remains unchanged.

## Remaining scope

Pickup/delivery zones, guest checkout, payment deadlines, supplier workflows and uploads remain deferred. Production migration, real integration checks and full browser acceptance are still outstanding. The simulator strengthens FYP objective 4 by making recorded cost information actionable without applying speculative prices automatically.
