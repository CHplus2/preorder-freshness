# Mobile inventory creation and recovery — 7 October 2026

Environment: isolated SQLite review database, localhost:8024, synthetic owner session, 390 × 844 browser viewport. No production stock or database changes.

## Findings and changes

- Reproduced an invalid inventory submission leaking its field errors into the unrelated Create Raw Material dialog. Closing any inventory/material form now clears its error; dismissal is disabled during a pending save.
- Failed post-save list refreshes now have separate feedback saying the change was saved, with a read-only Refresh records action. They do not invite another create request.
- Inventory transport/server errors preserve entered values and direct the owner to inventory records before retrying an uncertain save, rather than My orders. This is not server-side inventory idempotency.
- Background form errors are hidden while a dialog displays them. Existing restrained feedback and mobile action spacing are retained.

## Executed checks

1. Empty Add Inventory submission: backend field errors appeared in the dialog.
2. Cancel, then open Create Raw Material: zero stale alerts after the fix (the error appeared here before the fix).
3. Enter Rice, 125 g, MOBILE-20261007, Synthetic dry shelf, received 2026-10-07, ambient storage, printed deadline 2026-10-12. Stop only the isolated server and submit: values remained and failure feedback was visible.
4. Restore server and retry: creation returned 201, total batches increased from 2 to 3, and the list showed the matching 125 g batch and dates.
5. Load final build, edit that batch, stop server and save: inventory-specific uncertainty feedback displayed, with readable spacing and visible Save Changes/Cancel controls. See recovery.png.
6. Restore server and Reload latest batch: alert cleared and saved values loaded. No further stock mutation. Browser viewport reset and temporary test tab closed.
7. Frontend ESLint and production build passed. Initial sandbox build failed to spawn; approved build succeeded after correcting an intermediate file-encoding issue.

The successful-write/failed-refresh branch was inspected in code but not independently fault-injected in the browser. Lost responses after a committed write, every viewport, and production signed-in workflows are not covered by this batch. Native date input values were checked after keyboard commits. The synthetic batch remains in the isolated database for subsequent checks.
