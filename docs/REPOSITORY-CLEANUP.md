# Repository documentation cleanup

Reviewed 9 November 2026 for the current FYP client system on `main`.

Removed eight obsolete Markdown files: the two `CODEX_STEP_*` training/integration prompts, `DORMATHON_RUNBOOK.md`, `WORKFLOW.md`, `WEBSITE-CONTENT.md`, `docs/DAPUR-KITA-FYP-README.md`, and the two `docs/ESCROW-*` implementation notes. These described earlier agent tasks, the retired escrow flow, or a planning-first workflow that is no longer the current customer ordering flow. The active API contract now points to the current escrow retirement record. Previous versions remain in Git history.

The original `DORMATHON_REPORT.md` contains real model evaluation and integration evidence. It has been retained as [FreshCast backend audit history](freshcast/Backend_Audit_History.md), with references updated. Model implementation, model restoration and reproduction instructions, the saved model release, data contracts, migrations, application files and protected showcase/development branches are unchanged by this cleanup.

The root `README.md` remains the entry point for the FYP and now links to the latest presentation package. `DEPLOYMENT.md` remains necessary deployment guidance. `AGENTS.md` remains active contributor guidance for protecting the database, models and branches during future changes. They are current working files, not temporary download or training instructions.

Published report, poster and presentation downloads are retained so existing GitHub links continue to work. Private local capture databases, voice-model weights and temporary recordings are not added to the repository. No history is rewritten.
