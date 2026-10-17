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
- Removed menus or missing accepted preparation records require owner resolution; ordinary rescheduling does not guess their settings.
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

## Owner repair of an open request with no delivery date (17 October 2026)

Owner Orders now offers **Set delivery date** for a pending request that has no delivery date. The same `GET/POST /api/orders/{id}/reschedule/` preview/confirmation endpoint handles this narrowly scoped repair. Customers still cannot initialize a missing date, and normal rescheduling keeps the original rules above.

- GET includes the boolean `initial_delivery`. Only staff receive `initial_delivery: true`. An eligible initial request has `cutoff: null` because no earlier delivery/preparation time exists.
- A preview or history entry may contain `previous_delivery: null`; the UI says **Not recorded**, not an epoch date. Other date fields retain their existing requirements. The browser adapter accepts eligible null cutoffs only with the explicit initial-delivery flag.
- Only pending, nonrefunded, undeducted requests with no existing preparation reservation can be initialized. Empty orders, missing product links and archived menu references require review instead. The UI separately offers review of closing an obsolete request through the existing cancellation flow.
- The owner enters a specific future date and a reason. Existing scheduling checks enforce notice, delivery days/hours, capacity and the 90-day horizon. The requested delivery must also be more than 24 hours away.
- Accepted preparation snapshots are used if present. For migrated records lacking them, current menu settings are used only to validate the future request; they are not silently adopted as accepted terms.
- First-date repair always saves an **unscheduled request** with `needs_review: true` and no task reservation or preparation timestamps. The planner must review accepted recipes and confirm preparation before work starts. It must not be represented as an automatically feasible plan.
- The signed ten-minute preview, actor/order binding, version check, locked revalidation, audit amendment and idempotent confirmation still apply. No dates are filled automatically, and no historical fulfilment is invented.
- Prices, quantities, item snapshots, payment status, stock and order IDs stay unchanged. Recording a future request does not create a paid/delivered sale for forecast training.

Validation for this addition includes seven first-date API tests plus all fourteen existing rescheduling tests, frontend adapter tests, planner component checks, browser interaction checks with isolated fixtures, and the production frontend build. Live database repair and Vercel rollout are not established by those local checks.

The final scoped integration run passed 90 Django tests across first-date repair, rescheduling, commitments, planning, local planning and legacy cleanup. Frontend unit/predictive/planner/UX/checkout suites passed. The three-source browser review passed 27 source/view/width combinations; a separate browser check exercised first-date policy failure/retry, preview, confirmation, removal from the missing-date list and explicit request closure at 390px and 1365px. Browser API responses were fictional fixtures, not the owner's live records.
