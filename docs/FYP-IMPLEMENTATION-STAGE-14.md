# Stage 14: planner loading and failure states

Previously, a failed initial request could leave an empty shopping/task view underneath the error, while a failed refresh could leave earlier operational figures and calendar export available. This could make unavailable data look like no work or no shortages.

The planner now gates its operational content on a successfully loaded plan. During initial loading and refresh, a waiting message replaces the calendar, metrics, task/order review, shopping, packing and availability controls. Failed requests display a retry action. Old data is retained internally but is not rendered as an actionable plan. The packing print portal is also unmounted. Calendar export has an additional handler guard against loading, errors and missing data.

A successful response displays its local receipt time in Malaysia time. This is not a live subscription or a server transaction snapshot; owners should refresh after changing orders or stock elsewhere. No scheduling rules, orders, inventory or database schema were changed.

Follow-up: successful additions/removals of kitchen unavailable time now refresh the parent planner automatically. Previously the separate availability panel updated its list while daily available minutes remained based on the old plan. The refresh uses the same loading/error gate, so a failed reload cannot leave the previous capacity figures actionable. Availability fields are disabled while loading/saving, the initial empty list is not presented as confirmed, and label/button spacing is explicit. The callback runs only after a successful mutation; validation errors preserve the entered form.

Follow-up validation: all 28 isolated SQLite planning tests passed, including closure permissions and conflict rejection. The rendering regression also checks the availability panel's initial loading state and disabled fieldset. Targeted lint and production build passed. The add/remove-to-refresh browser interaction has not been manually verified.

Validation: component rendering checks cover initial loading, refresh with cached data, failed refresh, missing data and ready state. They verify that protected child controls and misleading empty-state messages are absent until data is ready. Targeted ESLint and production build passed. Browser failure simulation and visual layout have not been manually verified for this batch.
