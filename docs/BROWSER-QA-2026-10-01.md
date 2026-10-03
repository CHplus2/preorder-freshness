# Desktop browser checks — 1 October 2026

Used a dedicated local preview on port 8021 with the named temporary SQLite review database and synthetic owner/buyer accounts. The older port 8011 served outdated HTML referencing an earlier bundle, so it was not used as evidence for the current release. No production records were modified.

Verified through browser interaction and DOM geometry:

- Owner Settings renders with a 46px Save settings button and 36px between its bottom edge and the setup checklist. No horizontal document overflow at the tested desktop viewport.
- Menu editor opens successfully. Changing sample portions from 10 to 25 and enabling independent batches updates the preview to three batches, a final partial batch of five, and 90 minutes for the sample 30-minute recipe. Cancel discarded these unsaved test edits.
- A synthetic owner order displays Edit order and Payment records with a 12px gap; accepted recipe history is separated from the action footer by 24px. Total and actions remain aligned without horizontal overflow.
- Found and fixed the overdue filter checkbox appearing above its label. After rebuilding and restarting the dedicated preview, the browser confirmed an 18px checkbox with a 10px gap in an inline row. A full-page screenshot was inspected.

Production build and diff checks passed for the alignment fix. These checks cover desktop rendering and the interactions described, not mobile layouts, production Vercel sessions, real payment operations, print preview, or every recently added panel.
