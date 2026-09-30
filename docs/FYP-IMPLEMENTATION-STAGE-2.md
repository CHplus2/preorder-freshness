# Stage 2: customer delivery rescheduling

Implemented 30 September 2026. The application remains single-vendor.

## Value and scope

Customers can change a pending preorder's delivery time without asking the owner to recreate the order. This strengthens objective 1: flexible date-based preordering and scheduling. Owners can use the same flow after agreeing on a change with the customer. Both parties can inspect the recent delivery-change history.

Open **My Orders → Delivery changes and history**, or the same panel in owner Orders. Enter a new delivery date/time and a reason, preview the proposed change, then confirm. Times are explicitly Malaysia time, including when the browser uses another timezone.

## Rules

- The order must be pending, not inventory-deducted, and not refunded.
- Online changes close exactly 24 hours before the currently planned preparation starts. The new preparation time must also be more than 24 hours away. This is a fixed application policy in this batch.
- New dates must satisfy fresh lead time, the existing 90-day horizon, kitchen hours, worker/equipment reservations, closures and daily menu capacity.
- The order's own booking is excluded while checking its replacement. Other orders are not moved.
- Accepted recipe and preparation settings are used. Current daily menu capacity still applies. Prices, quantities, payment records, address and delivery method stay unchanged.
- Removed menus or missing accepted preparation records require owner resolution; this feature does not guess their settings.
- A signed preview expires after ten minutes and reserves no capacity. Confirmation locks the store/order/menus and recalculates availability. Changed orders or changed plans require another preview.
- Repeating the same valid confirmation returns the current order without creating another amendment or restoring an old date.
- Only the customer who owns the order or a staff owner can access it. Preview tokens are bound to the acting account and order.
- Delivery history contains old/new delivery times, reason, actor role and time. Recipe/financial internals are not included in the customer history. The most recent 20 changes are shown.
- Existing recipe amendment history remains separate in its own panel.

Changes are visible in the order screens and subsequent planner loads. No automatic rescheduling email, SMS, WhatsApp message, or owner approval queue was added. Existing reminders read the current order schedule. The cutoff deliberately prevents ordinary self-service changes after the preparation reminder window begins.

## Verification

- Full isolated SQLite backend run: 126 tests discovered, **125 passed, 1 PostgreSQL-only test skipped**.
- Fourteen new rescheduling tests cover preview without mutation, preserved accepted terms, repeat confirmations after subsequent changes, access controls, actor-bound tokens, expired/tampered previews, exact cutoff, invalid inputs, capacity rechecks, changed kitchen availability, same-day capacity exclusion and status guards.
- Following the final history integration fix, all 37 rescheduling and commitment tests passed again.
- All 10 existing frontend utility tests passed; targeted ESLint passed for `RescheduleOrder.jsx`.
- Production frontend build passed. The initial sandbox run could not spawn Vite's child process; the permitted build outside the sandbox succeeded.
- `makemigrations --check --dry-run` found no changes. This stage uses the Stage 1 `OrderAmendment` model and needs no additional migration.
- Browser interaction and PostgreSQL concurrency for rescheduling have not been verified. Unit/API checks and compilation are not an end-to-end usability test.

No production database changes, deployment, real payments or external messages were performed. Apply the Stage 1 migrations before deploying these combined changes.

## Manual acceptance

1. Create a pending order whose preparation begins at least four days from now.
2. As its customer, preview a later time. Close the preview and verify the original delivery remains.
3. Preview and confirm a new time. Verify the new time in My Orders, owner Orders and Planner, plus an unchanged total and accepted recipe.
4. Reload and inspect delivery history. Confirm the owner recipe-history panel still works.
5. Preview another change, then change capacity or add a conflicting kitchen block as owner. Confirm the old preview cannot silently apply a different plan.
6. Try another customer's order, a processing order and an order at the cutoff; verify they cannot be changed.
7. Repeat on a phone-width layout and a browser with a timezone outside Malaysia.

## Remaining batches

Pickup and delivery service areas, guest checkout, payment deadlines, supplier/purchase-order workflows, photo uploads and onboarding remain deferred. Real payment integration, production monitoring and complete browser acceptance are also separate work. No multi-vendor conversion is planned.
