# Cooking and wastage browser recovery

6 October 2026. Isolated localhost:8023 and temporary SQLite, dotenv disabled, synthetic owner/buyer only. No production changes or payment receipts.

## Executed

- Created synthetic processing order 4 (100 g accepted rice recipe). Browser Cooked action rejected: short by 100 g. Read-only database check confirmed processing, inventory_deducted false, zero consumption rows and expired REVIEW-01 still 900 g.
- Added a separate 150 g usable restock fixture through Django shell. Browser Save succeeded; repeating Cooked Save left exactly one consumption row, 50 g usable stock, 900 g expired stock. Order remained unpaid.
- Browser waste submission for 60 g against the 50 g batch rejected. Database confirmed 50 g and zero waste records.
- Found error above viewport; added scroll/focus to cost feedback and clarified read-only refresh label. Rebuilt browser test confirmed focused visible alert, preserving entered values.
- Corrected waste quantity to 10 g and submitted. Saved confirmation, 40 g remaining, ledger 10 g / RM 0.20.
- Found UTC date shown as 5 October despite Malaysia date 6 October. Fixed display with timezone.localtime; reload showed 2026-10-06.

## Checks and limits

Frontend lint and build passed. Nine cost/freshness backend tests passed, including new UTC/Malaysia boundary regression and existing wastage retry/overdraw tests. Browser repeat cooking verified; duplicate wastage request protection covered by existing automated test, not browser request replay. Restock was a fixture operation, not a test of the add-inventory form. No new mobile or production verification.

Screenshots: wastage-error.png and wastage-saved.png. Synthetic records retained for inspection.
