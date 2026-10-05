# Inventory form validation and recovery

6 October 2026. Tested on isolated localhost:8023 with the synthetic review-owner account and temporary SQLite database; dotenv disabled. Production was not accessed.

Observed defect: changing stock from 900 g to 899 g without an adjustment reason correctly returned validation failure, but the error was above the visible dialog area. Save appeared unresponsive.

Change: shared inventory dialog feedback scrolls into view and receives focus when an error arrives. It preserves form values and uses a restrained accent, readable spacing and left-aligned text. Applied to create/edit ingredient and inventory dialogs. Storage guidance paragraphs are left-aligned.

Verified in the rebuilt browser:

- Invalid adjustment produced a visible focused alert; the entered 899 g remained in the form.
- Reload latest batch restored 900 g and cleared the alert.
- Saving Hold batch closed the dialog and showed HELD in the table and On hold in the attention list.
- The synthetic hold was then cleared to restore the original fixture.

Lint and production build passed. Screenshot: visible-error.png.

Limits: no browser cooking-shortage/restock or wastage flow in this batch; those remain pending. No new mobile verification. Existing backend shortage tests are documented separately in freshness-recovery-20261006.
