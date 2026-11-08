# FYP cleanup and forecasting preservation — batch 1

Reviewed 8 November 2026 on `main`, starting at `8594d97020b0421eaaa403b6f44c68c3f4965e1f`. This batch changes presentation materials and documentation. **No source files or branches have been deleted, and no forecasting behaviour has been changed.**

## Important forecasting assets are protected

| Asset | Purpose | Preservation decision |
| --- | --- | --- |
| `integration/dormathon-demo` | Published FreshCast/showcase branch | Preserve; do not push main changes into it. |
| `backend/predictive_ai/service.py` and its model loader | FreshCast inference using the trained Genpact model | Preserve. |
| GitHub Release `freshcast-model-backup-v1` | Original trained model, matching data and metrics | Preserve release asset; verification below. |
| `backend/myapp/services/kitchen_forecast.py` | FYP forecast from database order history, using local statistical methods | Preserve, along with the local-forecast API and interface. |
| `backend/predictive_ai/train_local_bookings.py` | Separate offline experimental model candidate | Preserve; do not describe this candidate as the live Genpact model or the FYP local forecast. |
| AI feature branches and report worktree | Existing development/report work | Preserve until a separate, complete backup and dependency review establish what is redundant. |

The FYP local-history forecast and FreshCast's Genpact model are different implementations. A folder called `predictive_ai` also contains shared endpoint registration; it cannot safely be removed as a whole merely because `main` is the FYP branch.

The original model archive was downloaded from the public [GitHub Release](https://github.com/CHplus2/preorder-freshness/releases/tag/freshcast-model-backup-v1). Its SHA-256 matches `697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a` (5,899,808 bytes). The archive contains `artifacts/demand_model.cbm` (1,126,016 bytes), `artifacts/metrics.json`, and the six matching CSV inputs. No training, model replacement or new accuracy evaluation was performed. Model weights/data were not added to the source tree.

Django loads provisioned model files on the server. Their presence in a GitHub Release does not itself prove that a particular Vercel deployment has them. Current production model readiness was not checked in this batch. See [model restoration instructions](../backend/predictive_ai/README.md).

## Cleanup requires complete dependency changes

Escrow is a cleanup candidate, but its standalone folder is still referenced by CI. Frontend routes/imports and backend URL registrations also exist. A later batch must remove the retired flow together, verify imports/build/affected tests, and preserve shared payment records and historical migrations. Deleting the folder alone would leave broken references.

Likewise, predictive frontend/backend folders mix FYP functions with the FreshCast demonstration. Keep shared forecasting, order, stock and reporting dependencies. Do not infer that code is unused solely because it is absent from a customer-facing page.

The starter-data JSON files under `docs/` are referenced by management commands and explicitly retained by `.vercelignore`. They are not disposable report drafts. Existing report/poster/video downloads must remain available until replacement links and backups are verified.

## Branch observations

The local `work` and `feature/ai-dashboard` tips were ancestors of the starting main commit. The local integration and report branch tips were not. A separate report worktree exists. These facts alone do not establish that any branch or worktree is safe to remove. Remote-tracking integration and the local integration tip differ; neither was reset or pushed. No fetch or remote branch deletion was performed as part of this audit.

## Repository size versus deployment size

At the start of this batch, tracked `docs/` files totalled about 184 MB, screenshots about 4.9 MB and `escrow/` about 72 KB. Much of the repository size is published reports/videos/ZIPs. `.vercelignore` excludes those presentation/report assets from application uploads. Removing a file from the current tree does not erase it from Git history or necessarily shrink a Vercel function. Shared history will not be rewritten as a cleanup shortcut.

## Subsequent batches

1. Remove verified retired escrow routes, imports, CI references and standalone code coherently, while preserving shared payment/history behaviour.
2. Review duplicate documents and temporary exports against published links and backups; retain important reports, data definitions, diagrams and deployment instructions.
3. Review any remaining branch candidates against backups, unmerged commits and worktrees. Keep the published integration branch and important AI work.

The user's clarification is explicit: important files and the AI powering FreshCast are not cleanup targets.
