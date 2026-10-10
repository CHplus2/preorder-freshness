# Dormathon 2026 collaboration

- Continue backend work on `feature/ai-backend` unless the user explicitly directs otherwise. Inspect branch, working tree, index, and remotes before changes; preserve existing uncommitted work.
- Commit only relevant tested task changes with a descriptive message and push to `origin/feature/ai-backend`, setting upstream on the first push. Never push directly to main, force-push, or automatically merge.
- Do not commit credentials, `.env` files, databases, large datasets, or generated ML artifacts.
- Follow `CODEX_STEP_1_AUDIT_AND_TRAIN.md`, then the backend portions of `CODEX_STEP_2_INTEGRATE_AND_BUILD.md`. Genuine source data, trained artifact, and evaluation metrics are prerequisites for integration. Do not substitute fabricated forecasts.
- The React prediction dashboard belongs to the other developer on `feature/ai-dashboard`; do not implement it here.
- Keep `docs/predictive-api-contract.md` synchronized with implemented endpoints and clearly distinguish proposed endpoints from available ones.
- Report active branch, completed changes, tests, model evaluation results, and pushed commit after each task.
