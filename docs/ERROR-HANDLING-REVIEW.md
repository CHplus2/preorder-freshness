# Error handling review — first hardening batch

Good exception handling is boundary validation, useful recovery, transaction rollback and diagnostic evidence. It does not require try/catch in every function. Inner functions should propagate failures to a boundary that can handle them correctly.

## Inspected core paths
Order placement validates inputs, serialises bookings with locks, uses an atomic transaction and replays checkout request IDs. Inventory consumption checks accepted recipes and uses locked inventory rows; failure rolls back the enclosing status update. Payment records validate transitions and request IDs under transaction protection. Scheduling rejects impossible work instead of inventing availability. The API exception handler preserves validation errors, returns 409 for conflicts, sanitises unexpected failures and emits diagnostic references; database operational errors return 503.

## Changes
- Explicit list/slot response validation prevents malformed successes becoming empty-order screens or render crashes. Existing error/loading states provide recovery.
- Checkout requires a confirmed order ID before clearing the request reference. Local storage cleanup errors after confirmation cannot turn a successful order into a failed-order message.
- Recovery tests cover malformed responses, validation errors, conflicts, database outages and unexpected backend failures.
- Setup actions are named by purpose; all three still open menu management because that editor owns recipes, steps and cost estimates.
- Named text links use a consistent 4px underline offset instead of mixing a padded bottom border with a text underline.

## Limits and follow-up batches
This is not a certification that every file or edge case is covered. Remaining work includes browser-storage availability/corruption before checkout, stale concurrent responses and session changes, structured payload validation beyond list envelopes, authenticated browser failure injection, provider timeouts in the optional AI helper, and deployment/database concurrency tests against isolated PostgreSQL. No live destructive failure injection was performed. Do not automatically retry order/payment writes with new request IDs; a timed-out write may already have succeeded. Do not fall back to fabricated stock, payment success or accepted schedules.
