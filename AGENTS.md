# Project workflow — updated by the owner on 2 November 2026

- All new implementation work, commits and pushes go to `main`. The owner's
  explicit instruction supersedes the former integration-only workflow.
- `integration/dormathon-demo` is the frozen FYP website baseline, matching source
  revision `ab1a97684dbf5d8b992b9f74fd07580b59d4636d` cited in the report evidence.
  The only authorized integration write is the one-time rollback requested on
  2 November 2026. After that restoration push, do not push to integration again.
- Preserve `feature/ai-backend`, `feature/ai-dashboard` and the existing FYP report
  branch. Do not push main's changes to those branches. The rollback changes code
  only; do not downgrade the shared database or delete applied migration records.
- Inspect the working tree and remotes before changes, preserve user work, and
  commit and push relevant tested changes to `origin/main` with a descriptive
  message. Never force-push or rewrite shared history.
- Do not commit credentials, `.env` files, private databases, bank QR images,
  customer evidence, large datasets or generated ML artifacts.
- Forecast/model work requires genuine data, real artifacts and evaluation;
  do not fabricate forecasts or train inside API requests. Follow the relevant
  backend audit/integration documents when changing forecasting behavior.
- Keep `docs/predictive-api-contract.md` synchronized with implemented APIs.
  Preserve the existing predictive dashboard; make only changes explicitly
  authorized by the user when that dashboard is involved.
- Report the active branch, completed work, checks, model changes/evaluation
  where relevant, and pushed commit. Distinguish source publication from a
  verified successful Vercel deployment; Production and Preview settings differ.
