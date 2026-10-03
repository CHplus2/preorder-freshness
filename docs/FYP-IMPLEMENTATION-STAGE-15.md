# Stage 15: printable shopping checklist

Planner > Shopping now provides Print shopping checklist when shortages exist. The print-only sheet uses the same grouped quantities as the screen, retaining units, first-needed dates, order references and per-order requirements. It includes writing space for actual purchased quantities and costs, the plan-loaded timestamp and an explicit incomplete warning when accepted recipes are missing.

The sheet is a paper aid, not a purchase order or inventory mutation. Record received batches separately. The existing planner loading/error gate unmounts the print sheet when a refresh is pending or fails. Switching away from Shopping also removes its print portal, so it cannot collide with the packing sheet.

Validation: four shopping aggregation tests, planner/checklist rendering checks, targeted lint and production build passed. Print-dialog pagination and physical paper output have not been manually verified. No database changes.
