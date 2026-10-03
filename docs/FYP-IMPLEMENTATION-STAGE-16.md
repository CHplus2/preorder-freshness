# Stage 16: saved-plan equipment and closure warnings

The daily planner now checks saved pending/processing tasks for overlapping use of the same named equipment, including unattended tasks. Legacy whole-kitchen reservations conflict with every resource. Two `none` tasks do not conflict merely because both use no equipment. Touching endpoints are not overlap.

It also flags work intersecting kitchen closure intervals, including unattended work outside normal opening hours. Closure checks use the selected Malaysia calendar day; available worker minutes continue to subtract only closures within opening hours.

Affected task cards identify equipment and/or closure overlap. The day warning reports minutes with any equipment conflict and minutes with any closure conflict. Each measure is a union of its intervals, not a sum of task pairs or equipment-hours; the two measures can overlap each other and should not be added. Existing worker and opening-hour warnings remain.

This is a review aid for saved plans, not a new scheduling algorithm. It does not move orders, change recipes, add capacity or bypass server booking checks. It follows the application's one-unit-per-named-equipment model. No schema or live records changed.

Follow-up: each affected task now has expandable conflict details identifying the other task and order, or the closure reason. Overlap times are clipped to the selected day and displayed in Malaysia time. Worker-only conflicts are included, even when equipment differs. A pair with both worker and equipment overlap is shown once as Equipment and worker. Review order opens the existing order-review section; it does not replan or save anything. A closure has no order link because it is managed through Kitchen availability.

Follow-up validation: all 12 planner utility tests, component rendering checks, targeted lint and production build passed. Tests cover reciprocal order references, worker-only conflicts, named closures and day clipping. Browser interaction and layout remain unverified.

Validation: all ten planner utility tests passed, including unattended equipment overlap, independent resources, touching endpoints, overlapping closures outside opening hours, legacy reservations and completed-order exclusion. Source plans are not mutated. Targeted ESLint and production build passed. Browser layout has not been manually verified for this batch.
