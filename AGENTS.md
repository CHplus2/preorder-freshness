# Dormathon 2026 collaboration

- Current final-integration work is on `integration/dormathon-demo`, explicitly authorized by the user. Preserve both `feature/ai-backend` and `feature/ai-dashboard`; do not push integration changes to either feature branch. Inspect branch, working tree, index, and remotes before changes; preserve existing uncommitted work.
- Commit relevant tested integration changes with a descriptive message and push to `origin/integration/dormathon-demo`, setting upstream on the first push. Never push directly to main, force-push, or merge into main. The feature-branch merge into this integration branch is authorized.
- Do not commit credentials, `.env` files, databases, large datasets, or generated ML artifacts.
- Follow `CODEX_STEP_1_AUDIT_AND_TRAIN.md`, then the backend portions of `CODEX_STEP_2_INTEGRATE_AND_BUILD.md`. Genuine source data, trained artifact, and evaluation metrics are prerequisites for integration. Do not substitute fabricated forecasts.
- The React prediction dashboard belongs to the other developer on `feature/ai-dashboard`; do not implement it here.
- Keep `docs/predictive-api-contract.md` synchronized with implemented endpoints and clearly distinguish proposed endpoints from available ones.
- Report active branch, completed changes, tests, model evaluation results, and pushed commit after each task.
