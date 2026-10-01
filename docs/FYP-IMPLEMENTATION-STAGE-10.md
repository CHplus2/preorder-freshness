# Stage 10: independent batch planning and customer order progress

## Preparation planning

Menus with detailed steps now have an explicit owner option: **Schedule each batch as a separate complete recipe**. It is off for existing menus. It is stored consistently on all preparation-task JSON rows and included in the existing accepted preparation snapshot; no schema migration is needed.

In this mode, `ceil(portions / batch_size)` complete recipes are scheduled. Each batch uses every step's full first-batch duration, including a partially filled batch. Additional-batch minutes are ignored. This is intentionally different from the existing combined-step duration formula, which remains unchanged when the mode is off. Planner steps display batch numbers; checkout totals use the same duration policy.

Batches can span days only within the menu's maximum early-finish and preparation-span limits. Each step remains uninterrupted; the existing unattended overnight-rest rules, permitted gaps, opening hours, worker, equipment, lead time, closures and daily portion limits still apply. The model has one worker and one of each resource. It does not model storage-space volume. Batch numbers identify recipe runs, not chronological production order. Existing bookings are never moved.

The scheduler now retries an entire new sequence earlier when an upstream step cannot meet its permitted gap, without retaining resource reservations from failed attempts. Oversized uninterrupted steps receive a specific error explaining the daily work-window limit. Other failures identify the step, duration, working hours and early-finish constraint instead of suggesting that changing the date will always help.

Automatic planning remains a conservative bounded search, not a complete optimizer. There are at most 100 independent batches per menu and 200 sequence-placement attempts per batch. A failed search does not prove a human cannot devise another arrangement. This release does not add an owner-review request queue or a bypass for unconfirmed orders. Owner changes to durations and handling limits remain explicit; no production recipes were changed during development.

For Granola Bar, review actual portions per batch and whether mixing requires hands-on work before enabling this mode. Raising early-finish limits is a business/handling decision, not an automatic remedy.

## Customer tracker

My Orders maps existing statuses to Order received → Preparing → Ready for delivery → Out for delivery → Delivered. The display reflects the kitchen's current recorded status; it does not invent transition timestamps or provide courier location tracking. Refresh order status reloads the records. Cancelled and unrecognized statuses have separate messages. Payment remains separate.

Delivered orders link to their existing menu review pages; duplicate menu links are removed and deleted products are skipped. The existing review API still decides eligibility and prevents duplicate reviews. Reviews are an action after fulfilment, not an order status.

## Validation

- Full backend suite: 154 tests completed successfully, with one PostgreSQL-only test skipped under isolated SQLite.
- After adding two further regression cases, all 28 planning tests passed, including 20 two-step independent batches, exact duration totals, within-batch dependencies, worker/equipment conflicts, early-finish enforcement, partial batches, bounded validation, retry cleanup and saved preparation mode.
- All 28 frontend utility tests passed, including tracker statuses and cancellation/unknown handling.
- Targeted frontend lint, production build and diff checks passed.
- End-to-end browser journeys and production PostgreSQL concurrency were not verified in this batch. No live order or menu configuration was modified.
