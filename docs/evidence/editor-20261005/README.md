# Menu editor walkthrough — 5 October 2026

Isolated localhost:8023 SQLite fixture, dotenv disabled, synthetic owner account. No live menu edits.

Verified the three Settings review links through the browser. Each opened its contextual menu list; clicking the matching edit action focused the ingredient selector, Add preparation step button, or packaging cost input respectively. These links intentionally share a menu list but target different editor sections.

Stopped the isolated backend and opened an existing recipe. Error and Retry ingredients appeared; quantity 100 and packaging cost 0.50 remained. The old selector misleadingly showed Choose ingredient. After the fix and a fresh build, repeating the outage showed a disabled selector with the saved ingredient reference and details unavailable. Restarting and retrying restored Rice (g), quantity and packaging cost without saving anything.

Editor explanations are left aligned, recipe rows have explicit spacing, the no-steps explanation uses a quiet side rule, and retry feedback puts its button on a separate row. Inspected the recovered editor at 390px; inputs wrap and Save/Cancel remain visible. The final retry-button CSS adjustment was build-checked; the screenshot shows the recovered state with no error. Viewport reset and modal cancelled after verification.

ESLint and production build passed. This targeted test does not cover every possible editor validation case. [Mobile editor](mobile.png).
