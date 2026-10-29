# Revision and submission notes

This is a newly assembled editable Word master, not a modification to the original PDF file. The original uploaded report remains unchanged. Source baseline: `ab1a97684dbf5d8b992b9f74fd07580b59d4636d` (29 October 2026). No website source, website branch or production database was changed by this report-writing task.

## What changed

- The five objectives in Section 1.3 are preserved verbatim. Objective 5 is not weakened to hide its unmeasured conversion/decision-fatigue outcomes.
- Chapters 1–2 retain the proposal's structure, literature rationale, original Gantt chart and literature map. Narrow corrections qualify provider comparison dates, explain the actual scope and backend/frontend split, and avoid claiming universal food-safety control or implemented subscription billing.
- Chapter 3 retains UC-01–19, updates their actual behaviour and adds UC-20–30. It replaces obsolete diagrams with current use-case, activity, sequence, domain class and four ERD views. The original duplicate “3.6 Sequence Diagrams” class heading is corrected.
- Chapter 4 replaces the older implementation continuation. It covers the current customer/owner flows, upload sanitisation, independent hours, multiday planning, snapshots, grouped updates, current whole-order recommendations, financial evidence, all three FreshCast sources, test payments, reminders and manual courier coordination.
- Chapter 5 contains decision tables, 42 executed test-case summaries, current test counts, the external model comparison and an objective-linked UAT instrument. No senior's participant numbers, survey results, signatures or wording are copied.
- Chapter 6 is the final main chapter. References and Appendices A–G follow it.
- A source-derived dictionary lists all 26 application models. The separate Django User/auth/session tables are outside that count.

## Format used

The supplied briefing is a collage of selected marking/submission guidance, not a complete university style manual. The senior's Word file contains mixed margins, orientations and spacing. The original PDF uses Letter pages with Times New Roman 12-point body text and approximately 1.5 spacing. The senior uses A4 and typically a wider binding margin.

This master normalises those conventions to **A4; Times New Roman 12-point; 1.5 body spacing; justified paragraphs; 4 cm left/binding margin and 2 cm top/right/bottom**. Headings are black/bold, chapter titles 14-point, ordinary headings 12-point; tables use 10-point single-spaced text and captions 11-point. Use-case, class, ERD and architecture pages are landscape with 2 cm margins to keep labels readable. Front matter uses Roman page numbers and main text restarts at 1. The Word file requests Times New Roman; the local PDF renderer may substitute the metrically similar Liberation Serif because the Microsoft font is not installed here.

Font consistency correction: all document text styles, linked heading styles, contents fields, table text, headers/footers and defaults now explicitly use Times New Roman, with theme font overrides removed. The 23 redrawn technical diagrams also declare Times New Roman. Original Gantt/literature-map images and website screenshots retain their original lettering. Diagram lettering is editable in the included native draw.io sources, separately from report text. The local PDF still uses the documented serif substitute when Microsoft Times New Roman is unavailable.

The contents, figure and table lists contain editable Word fields with populated page references. If you change the document in Microsoft Word, select all and press F9 to refresh fields, then review pagination. Do not insert the original PDF's old contents pages or old Chapters 4–6 on top of this new master.

## Evidence and remaining author input

1. Fresh application verification: 829 discovered checks; 806 passed in SQLite and the remaining 23 passed separately on PostgreSQL. Thirty-four release tests passed. All ten frontend test commands, lint and build passed. A main-chunk size advisory remains; no production latency or load capacity is claimed.
2. Model plot: the existing original Genpact artifact's holdout result is reproduced evidence, not new training and not kitchen accuracy. Source data/model are not bundled in the report ZIP. Use the separate GitHub Release backup when restoring that runtime.
3. All current-interface screenshots use a dedicated disposable local database. Catalogue values follow the existing starter reference, stock is illustrative, future order plans were created through the normal application path, and generated history carries the existing synthetic-history marker. They prove what the interface displays, not real sales, storage temperatures or provider transactions.
4. No actual user survey, independent tester sign-off, ethics approval or field observations were supplied. Chapter 5 describes the executable protocol instead of inventing results. Agree recruitment/sample size and success criteria with your supervisor, collect real consented data, then update the evaluation and conclusion if the evidence supports it.
5. Attach your genuine eight-consultation logbook if required by the current briefing, the actual similarity report and the current institution's completed integrity form. Appendix C is unsigned; its current course/lecturer/date fields are deliberately not invented. Follow your institution's requirements for acknowledging assisted editing and any reused or collaboratively developed modules; this revision does not certify sole authorship.
6. The original literature references have been retained, with mechanical line-break repairs and explicitly added primary guidance/source references. Their metadata, platform policies and any department-specific referencing requirements still need the author's final reference check. The senior's report was used as structural guidance, not as proof of features or a valid source of your results.
7. Confirm the official project title, supervisor, current course code and faculty cover requirements before submission. The project title, student name/ID and supervisor reproduce the supplied report; the IT Project 1 declaration's course code was not assumed to be the IT Project 2 code.
8. Local tests do not verify current Vercel Ready status, live SMTP scheduling/inbox receipt, live Supabase policy/RLS state or actual provider/courier configuration. No GrabExpress API is claimed. PayPal Sandbox/Sepolia remain disclosed as test facilities.

## Briefing alignment

- Chapter 4: explains development decisions and problems/solutions alongside an illustrated operating guide, rather than screenshots alone.
- Chapter 5: traceable expected/actual checks; negative/retry/security/concurrency cases; discussion related to objectives/literature; UAT questions mapped to objectives.
- Chapter 6: objective-by-objective conclusion, challenges, advantages, limitations and prioritised suggestions.
- Submission: genuine consultation records, similarity report, integrity paperwork and the student's final review remain separate from software evidence. The collage is not treated as the full marking scheme or a guarantee of marks.

## Diagram layout revision — 30 October 2026

All 23 technical diagrams have been redrawn on explicit grids: two use-case diagrams, four activity diagrams, one domain class diagram, four ERD views, the architecture view and eleven sequence diagrams. Use cases use stick actors, system boundaries, oval goals and straight associations. Activities use rounded actions, guarded decisions and explicit merge diamonds. Class/ERD relationships follow right-angle routes around entity boxes. Sequence messages are horizontal, lifelines vertical/dashed, return arrows dashed/open, and self-calls rectangular. Transaction regions and explanatory UML notes are separated from message labels. These revisions change presentation and clarify notation, not the five objectives or implemented workflow claims.

The ZIP includes a native `.drawio` file for each technical diagram, with separately editable shapes, labels and connectors. Open these in diagrams.net or import into a compatible diagram editor. Vector SVG, high-resolution PNG and the full semantic-source JSON are included too. Concise on-diagram labels retain the fuller meanings in the JSON/tooltips and chapter explanation. There is no claim that the diagrams were produced by Visual Paradigm or Lucidchart.

The generator and renderer are included for reproducibility. They require Python, Pillow and the headless Inkscape command. Original screenshots, the original Gantt/literature map and the model-evaluation figure are unchanged.
