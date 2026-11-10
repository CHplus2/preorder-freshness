# Repository documentation cleanup

Reviewed 10 November 2026 for the current FYP client system on `main`.

## 10 November follow-up

Removed 30 superseded documents from the current tree: the sixteen September/October `FYP-IMPLEMENTATION-STAGE-*` notes, the old source catalogue/technical handoff, `NEXT-BATCHES.md`, the 27 October supervisor batch note, the 16 October synchronization note, and nine dated audit/review/verification records. They described earlier workflows or a completed investigation rather than the current client release. Their exact contents remain available in [the pre-cleanup revision](https://github.com/CHplus2/preorder-freshness/tree/93ca8da7a53bc7199533bb586a5a8cfd468f8309/docs). Existing documentation links to those files now point to that fixed revision, preserving access to historical evidence. Runtime inputs, model guides, deployment instructions, test evidence, evaluation forms and published download packages are retained.

Removed `backend/package.json` and `backend/package-lock.json`. These declared only Axios and dotenv, with no scripts or backend JavaScript files. The Python backend, build scripts, CI and deployment do not use them. The active frontend retains its own manifest and lockfile. Python and model requirements are unchanged.

The root README's first presentation/report links now open the current download folders. Earlier downloads remain available at their existing paths so previously shared links continue to work. Files still retained for a working feature or recovery are not classified as unused merely because they are outside checkout.

The two completed release branches `release/home-food-extensions` (`c0e15b27b7b6d72b1958d82af328441587aba8e4`) and `release/raw-material-guidance` (`2f01137f9425373c24dc3b2c51ff8f17aac066fd`) were checked as fully merged into main before removal. The redundant local `work` branch (`0333e77bdfbec8a9f0a9b006ff92888a6ca68360`) was also fully merged. Their commits remain in main's history. The remote AI branches, integration/showcase branch and FYP report branch are preserved; no history is rewritten or model release asset deleted.

Validation: all retained non-Markdown tracked files, including application source, both forecasts, migrations, data inputs and published report/poster/presentation binaries, remain byte-identical to the pre-cleanup revision. Documentation links to removed files resolve to their historical copies. All 37 deployment/runtime/provisioning checks passed with isolated configuration and no skips. The production database was not used. Source publication does not assert a new live Vercel verification.

## Previous cleanup

Removed eight obsolete Markdown files: the two `CODEX_STEP_*` training/integration prompts, `DORMATHON_RUNBOOK.md`, `WORKFLOW.md`, `WEBSITE-CONTENT.md`, `docs/DAPUR-KITA-FYP-README.md`, and the two `docs/ESCROW-*` implementation notes. These described earlier agent tasks, the retired escrow flow, or a planning-first workflow that is no longer the current customer ordering flow. The active API contract now points to the current escrow retirement record. Previous versions remain in Git history.

The original `DORMATHON_REPORT.md` contains real model evaluation and integration evidence. It has been retained as [FreshCast backend audit history](freshcast/Backend_Audit_History.md), with references updated. Model implementation, model restoration and reproduction instructions, the saved model release, data contracts, migrations, application files and protected showcase/development branches are unchanged by this cleanup.

The root `README.md` remains the entry point for the FYP and now links to the latest presentation package. `DEPLOYMENT.md` remains necessary deployment guidance. `AGENTS.md` remains active contributor guidance for protecting the database, models and branches during future changes. These files contain current setup and maintenance instructions.

Published report, poster and presentation downloads are retained so existing GitHub links continue to work. Private local capture databases, voice-model weights and temporary recordings are not added to the repository. No history is rewritten.
