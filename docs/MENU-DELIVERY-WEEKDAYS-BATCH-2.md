# Optional delivery weekdays — batch 2

Menus accept delivery on any day by default (empty delivery_weekdays list). Owners can choose weekdays in the recipe editor. This restricts the requested delivery date in Malaysia time, not when customers may place preorders or when preparation begins. Lead times, equipment, workers, existing bookings and ingredient planning continue to apply. This does not consolidate separate customer orders into shared cooking batches.

New order quotes, slot suggestions and placement use the shared scheduler to enforce weekdays. Guided discovery excludes disallowed weekdays before ranking the bounded candidates. Product detail, basket and checkout display the delivery weekdays. Accepted orders retain their original weekday rules in preparation snapshots; historical snapshots without this field stay unrestricted. Pausing remains the way to stop all new orders.

## Validation
- Full backend suite: 167 tests ran, OK with 1 skipped. New cases cover unrestricted defaults, allowed/blocked days, Malaysia time, input validation, accepted terms and legacy snapshots.
- Targeted frontend lint and production build passed.
- Browser layout review of the real component rendered with application styles: 390px viewport has no horizontal overflow, 44px choice rows, 12px checkbox/label gap and 12px Save/Cancel gap. This isolated preview does not represent a full authenticated owner end-to-end test.

## Release
Migration 0018_product_delivery_weekdays adds one JSON field, default []. Production migration applied on 2026-10-04 after explicit owner approval and verification of the local PostgreSQL backup. All 20 menus remained active with unrestricted delivery weekdays; 21 orders and 44 order items were preserved. No migrations remain pending.

The public storage-records text link now explicitly retains its underline, with a 44px minimum tap height and visible keyboard focus.
