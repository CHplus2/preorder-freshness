# Latest automated verification — 9 October 2026

Run started **9 October 2026 at 06:19:31 Malaysia time** (8 October 22:19:31 UTC).
Command: `backend\venv\Scripts\python.exe scripts/verify_fyp.py` from the repository root.

All eight verification commands exited successfully:

- Backend: **206 tests run; 204 passed, 2 skipped**. No failures.
- Release tests: **4 passed**.
- Frontend utility tests: `npm run test` passed. This script combines several test
  styles; no single aggregated assertion count is claimed.
- Product UX component checks: `npm run test:ux` passed.
- Checkout component checks: `npm run test:checkout` passed.
- Planner component checks: `npm run test:planner` passed.
- ESLint: `npm run lint` passed.
- Production build: `npm run build` passed. Vite still reports a non-fatal large
  bundle warning; a successful build is not a runtime performance measurement.

## Evidence and reproduction

Full evidence: [run manifest](evidence/20261008T221931Z/manifest.json),
[backend log](evidence/20261008T221931Z/backend.log),
[release log](evidence/20261008T221931Z/release.log),
[test inventory](evidence/20261008T221931Z/test-inventory.json) and
[source hashes](evidence/20261008T221931Z/source-hashes.json).
The other frontend/lint/build logs are in the same directory.

Base commit was `589085f29972cc058529abae83ffff64f0683598` with the reminder-settings
copy change in the working tree. The manifest correctly records a dirty tree;
source hashes identify the code tested. Documentation was completed after this run.

The runner disables dotenv loading and uses in-memory SQLite and in-memory email.
It does not use the live database or send real email. Each command's exit code and
log checksum are saved. Re-run the command after implementation changes instead of
reusing this result as evidence for untested future code.

## What was skipped or not established

Two PostgreSQL tests were skipped:

1. Concurrent replay of a checkout reference creates only one order/debit.
2. Two buyers cannot both purchase the last available portion.

Those tests require isolated PostgreSQL to verify real row-lock behaviour. SQLite
test success must not be presented as proof that these concurrency tests passed.
Prior separate runs, if cited, need their own dates and evidence.

This run did not test production Vercel deployment, real SMTP inbox delivery,
external scheduler uptime, real payment settlement, accessibility across all
devices, user satisfaction, business impact or food safety. Earlier browser tests
are separately documented in the evidence folder; they are not part of this
automated run. The latest reminder text was build/lint-checked, not browser-verified.

## Suggested Chapter 5 wording

> On 9 October 2026, automated verification executed 206 backend tests in an
> isolated SQLite environment. Of these, 204 passed and two PostgreSQL-specific
> concurrency tests were skipped. Four release tests also passed, along with
> frontend utility and component checks, static linting and the production build.
> The results support the tested functional and recovery behaviour, while live
> integrations, PostgreSQL concurrency and user evaluation require separate evidence.

Use selected named cases from the inventory to explain verification against each
objective. Discuss observed limitations and compare actual findings to literature.
These counts alone do not demonstrate improved conversion, reduced decision fatigue
or a new research contribution, and cannot guarantee a marking outcome.
