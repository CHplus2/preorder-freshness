# Individual preparation step editing

Owners can edit the start times of a pending order's existing detailed preparation
steps in Planner, under Edit preparation times. End times follow the saved duration.
Names, quantities, equipment, worker requirements and durations are preserved on the
server; submitted replacements for those properties are ignored. Every step must
be present exactly once, and successive steps of a recipe/batch must remain in order.

The preview warns about working hours, permitted waiting gaps, early finishing,
preparation span, conflicts within the order, other orders and kitchen closures.
Warnings require explicit owner confirmation; they do not certify handling safety.
Resource comparisons allow independent unattended steps on different equipment to
overlap. Gaps between edited steps do not reserve the kitchen, unlike the overall
manual-window mode. Each step remains continuous and is not automatically split.

The existing signed preview, owner permission checks, order-version check, audit
record and idempotent confirmation apply to step edits. Started orders remain
read-only. Manual-window orders need a generated detailed plan before individual
recipe steps can be edited. No schema migration is required.

## Verification

- 68 isolated backend tests passed across manual planning, automatic planning,
  rescheduling and account/wallet checkout.
- Added coverage for duration/resource preservation, dropped/duplicated tasks,
  recipe sequence, cross-day gap warnings, equipment-aware overlap, within-order
  conflicts, manual-window rejection and audit/idempotent confirmation.
- ESLint and Vite production build passed.
- Isolated local browser: synthetic order #6's generated 30-minute Prepare rice
  step moved from 13 October 2026 15:00 to 14:30 Malaysia time. Preview and save
  succeeded. Reopening showed 14:30–15:00 with stove and hands-on requirements intact.
- Narrow-viewport screenshot inspected and saved alongside this note. No live
  customer data was changed and production deployment was not browser-verified.

This completes the requested confirmation queue, manual overall windows and
individual timing edits. It does not add automatic interruption of cooking steps,
automatic optimal packing or food-safety guarantees.
