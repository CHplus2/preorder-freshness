# Direct FreshCast deployment on Vercel

## Connected kitchen release

The integration release adds default database-based My kitchen mode, preserves
the dashboard branch through `4700f89`, and keeps Genpact as a separately labelled
model demonstration. Backend/UI integration source is `27ce4fa`; `e355f6d` adds
appropriate local purchase validation messages. The original verified model
bundle remains unchanged. See [the demo runbook](../docs/FRESHCAST-DEMO-RUNBOOK.md)
for the served workflow, source boundaries and actual verification evidence.

Production preparation added one labelled fictional four-portion order and nine
assumed stock batches through normal staff APIs. Every original order and stock
record was compared and preserved. Planning and hypothetical purchase APIs are
read-only; builds still do not migrate or seed the production database.

## Earlier stable bundle source repair — 10 October 2026

The Production build of integration commit `2db0d0c` failed because its
`FRESHCAST_BUNDLE_URL` used the main website alias. That alias had moved to a
dashboard feature deployment without `/api/internal/freshcast-bundle/`; the
download returned HTTP 404. This was not model training failure or a database
migration problem.

The verified original archive now has a dedicated source:

`https://preorder-freshness-model-bundle.vercel.app/api/internal/freshcast-bundle/`

Source deployment: `dpl_CJLNBM5zPogshz5iTVpJYRQj2uyN`, READY, source `4f483e1`,
with the original ignored archive uploaded privately for bootstrap. Its source
hostname is explicitly allowed by Django. The alias is manually pinned to this
deployment and is **not** a project production domain, so normal website releases
do not automatically move it. Keep this deployment and alias; do not repoint or
delete them when changing the frontend.

The Vercel access exception applies only to this source alias. The archive still
requires the separate bearer token; anonymous requests returned HTTP 403 and
authenticated provisioning verified all eight runtime inputs against the
unchanged SHA-256. Django staff authentication remains in place. No global Vercel
protection policy was disabled, and no database migration or business-data write
was performed.

Production `FRESHCAST_BUNDLE_URL` now uses this source. The digest and token
bindings were preserved. Preview remains independent and requires its own safe
database/configuration. Build errors now report safe HTTP status or connection
failure without exposing signed URLs or credentials. Sixteen integrity,
packaging, entrypoint and build-gate tests plus three Django transfer tests passed.
The subsequent GitHub-source Production rebuild is READY:
`dpl_B31d5dQRxNikXqSrvzQN5bT25zRR`, source `427c385`, now serving
`https://preorder-freshness.vercel.app`. Its clean build downloaded and verified
the archive, completed the React build and packaged the Python function. Staff
requests to all five predictive APIs passed: model ready, 28.23% WAPE vs 34.81%
baseline, 77 centers, 51 genuine center-13/week-146 predictions and four simulated
risks; the CSRF-authenticated promotion request passed. Anonymous metrics/local
planning requests returned 403, and the FreshCast entry route returned HTML 200.

The local planning API also passed a live staff request with database sources,
three positive batches and one eligible batch. Its 18 active orders were all
excluded (`not_paid` or `preparation_needs_review`); zero included orders is not
evidence of zero demand. The existing Decision Assistant still uses Genpact;
the teammate's local-mode UI integration remains outstanding. Neither offline
experimental candidate was deployed. No full new browser walkthrough was run
for this release; these checks verify the build, served route and actual APIs.

Rollback retained: `dpl_77yzit29aZ4oXmsMNWtVqQXLnq43`, the dashboard branch release
previously assigned to the main alias. Neither developer feature branch nor main
was modified or merged by this repair.

## Earlier verified live release — 10 October 2026

At that verification, the live alias `https://preorder-freshness.vercel.app` served Git-source
production deployment `dpl_8yrHqPPmdU3Sfo1Qp1W9ueeUfcNB`, backend source commit
`a4f396b` on `integration/dormathon-demo`. This deployment cloned GitHub and
successfully downloaded the protected archive; no model/archive was uploaded
from Codex for that build. Python provisioning, React build and function
packaging completed and Vercel reported READY.

Hosted verification after alias assignment passed:

- Authenticated staff requests to all five predictive APIs; 51 predictions and
  four ingredient risks for center 13, week 146.
- Original model metrics: 28.23% WAPE versus 34.81% baseline. No retraining.
- Baseline forecast total 21,916.11 portions and promotion scenario 49,246.95;
  scenarios remain observational assumptions, not causal uplift.
- Browser: FreshCast Pantry in Live API mode, ingredient selection and assistant
  navigation, all 24 storefront photos, product/admin photos and mobile layout;
  no JavaScript page errors.
- Protected archive download: 5,899,808 bytes with the pinned SHA-256 below;
  anonymous requests return 403. The same verified archive is retained in the
  Git-built function for the next build.
- 21 focused local tests passed: eight Django predictive/transfer tests, ten
  integrity/packaging tests and three read-only build-release gate tests.

The production settings listed below have been configured securely. Production
uses the existing database bindings; no migration, order or stock changes were
performed in this task. Preview has independent environment settings and still
requires a configured safe database; a successful Production build does not
establish Preview readiness. No branch was merged into main.

Retained bootstrap: `dpl_4YdFao55QbYEuJVMtKEr5GP22FHj`. Previous working release:
`dpl_EVfnX9xfMAdB8zpDCAmJFTRvSEHC`. Keep these private-source recovery copies.
The older deployment records below are historical, not the current live status.

## Git-build bundle transfer

`Set a server-side HTTPS FRESHCAST_BUNDLE_URL` means the Git checkout has no
ignored archive and no configured download source. It is independent of the
preorder database and cannot be fixed by merging more branches or retraining.

The evaluated original archive can now be retained privately in the Python
function as `backend/predictive_ai/artifacts/runtime-bundle.tar.gz`. A deployment
that already contains it can transfer it at `/api/internal/freshcast-bundle/`
using a separate deployment-only bearer credential. Anonymous visitors, staff
sessions and credentials in query strings cannot download it. The route reads
one fixed, checksum-verified file, never database records. Responses are private
and noncacheable. The frontend never receives the credential.

Production build/runtime settings for this path:

- `FRESHCAST_BUNDLE_URL`: HTTPS URL of the protected transfer endpoint on the
  dedicated source alias above, independent of the main website alias.
- `FRESHCAST_BUNDLE_SHA256`: the original pinned digest below.
- `FRESHCAST_BUNDLE_TOKEN`: encrypted build download credential.
- `FRESHCAST_BUNDLE_EXPORT_TOKEN`: encrypted server transfer credential matching
  the download credential. This is separate from staff login and Vercel tokens.
- `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`: the existing Hobby-compatible beta path.

Bootstrap once with a direct source upload containing the verified ignored
archive and the export credential. Verify the hosted transfer before attempting
a Git-only build. That build downloads the archive, verifies SHA-256, safely
extracts the eight inputs, and retains the exact archive for subsequent builds.
It neither retrains nor applies migrations. Keep the prior working deployment
until its successor is READY and passes model/API checks.

Do not use the main website alias as the transfer URL: a frontend-only release
can remove the transfer route. Keep the dedicated source deployment/alias,
rotate download/export credentials together, and preserve the pinned digest.
Deleting the source or changing its digest independently breaks builds. This is a free
demo provision path, not independent artifact storage or permanent backup.
The pinned source deployment freezes its export credential. To rotate it,
redeploy the source with the verified archive and replacement export credential,
verify the source, and update the matching downloader credential together.
Changing project environment variables alone does not alter an old deployment.
An external private object store can replace the URL later without changing
prediction endpoints. Production settings do not automatically configure Preview;
Preview still needs its own safe database and corresponding bundle settings.

The five staff predictive endpoints and their source labels are unchanged.
See [data sources](../docs/FRESHCAST-DATA-SOURCES.md) for why the Genpact forecast
must not be joined to local product/inventory IDs.

The user wants a free demo on the existing Vercel site. Render is an unused
fallback; do not apply its paid Blueprint. No external compute host is required
if this Vercel project qualifies for the Large Functions path below.

## Verified deployment status: 2026-10-10

Following the user's subsequent request to put the completed application on their
usual Vercel site, the live alias was explicitly assigned to
dpl_24jfu8mggfzXmMZVCSs4ZiZTQcp5. Open:
https://preorder-freshness.vercel.app/admin/ai/decisions
Vercel's alias API confirms this assignment. Live HTTP checks returned 200 for the
FreshCast route and its assets; the served predictive JavaScript contains the new
FreshCast Pantry and visual ingredient evidence. Anonymous auth checks return
`authenticated: false`, and staff-only predictive metrics return 403 as expected.
Authenticated hosted predictions remain a separate check; the real-model browser
walkthrough passed locally. No main merge, production migration or business-data
write was performed. Previous live deployment for rollback:
dpl_5hRGTgzFYZiQxWWSH52a34nGQuhW.

The original model-backed candidate is now **READY** on the existing Hobby project:
`https://preorder-freshness-7kxvk8uwe-heroch94-3036s-projects.vercel.app/admin/ai/decisions`
(deployment `dpl_Ba3dM3DM9RpavB5q9azYaBUPbgBb`, integration commit `7b190c3`).
The build verified all eight inputs and successfully enabled Large Functions beta
for the Python app. At initial candidate validation, the public live alias still
pointed to its previous deployment; the later authorized switch is recorded above.

The newer candidate also includes teammate dashboard head `7efaee4`, integrated
by merge `fde26ef`, and reached **READY** with the same model bundle:
`https://preorder-freshness-59nms3a0y-heroch94-3036s-projects.vercel.app/admin/ai/decisions`
(deployment `dpl_24jfu8mggfzXmMZVCSs4ZiZTQcp5`). Use this newer URL for the
illustrated pantry. The real-model browser walkthrough passed locally; hosted
staff verification still requires existing authentication and hostname access.

Scoped Vercel project access now works through the Codex network-secret binding.
The CLI rejects that proxy placeholder before making a request, so the actual
upload used the supported HTTPS API: hashed source uploads to `/v2/files`, then
`/v13/deployments` with `target: production` and `autoAssignCustomDomains: false`.
The source manifest used Vercel's SDK ignore rules and tracked files plus the
single private archive. No `.env` or database files were uploaded. Large Functions
was enabled for this deployment's build/runtime; no project-wide env changes,
paid upgrades, retraining or production migrations were performed.

Authenticated source readback verified the exact original archive outside Codex:
`GET /v8/deployments/dpl_Ba3dM3DM9RpavB5q9azYaBUPbgBb/files/92be8d7965e758f330391f70f98efbd918f0fb77?teamId=team_ov7DxJtlllqPWthsBUNxCgrc`
on `api.vercel.com`. The JSON `data` field is base64; decoding yields 5,899,808
bytes with the original SHA-256 listed below. This recovery path requires scoped
Vercel authentication and retention of the deployment; it is not a public link
or a guarantee of permanent storage. Never put a token in the URL or repository.

Hosted staff/API validation remains separate from a successful build. Existing
Vercel protection and FYP staff authentication are retained. Codex egress needs
the generated deployment hostname allowed before browser/HTTP checks there.
Latest pantry UI integration and local browser validation are recorded in
`DORMATHON_REPORT.md`; use the latest candidate URL supplied with that task.

## Direct upload of the original model: no separate storage required initially

The original verified archive has now been staged locally at
`.freshcast-deploy/runtime-bundle.tar.gz`. Git ignores this directory; the explicit
`.vercelignore` allowlist lets a direct CLI source upload carry it without a Git
commit. The archive is also excluded from the Docker context and final Python
function; only its eight verified runtime inputs go into that private function.

`deploy/provision_vercel.py` automatically detects this archive, validates the
pinned original digest and stages inputs during the Vercel build. This path does
not need `FRESHCAST_BUNDLE_URL`, nor a separate artifact-storage account. An explicit
`--archive`/`FRESHCAST_BUNDLE_ARCHIVE` is also supported. If a checksum is supplied,
it is respected; otherwise local archive mode uses the pinned original digest.
The current auto-detection and checksum verification succeeded against all eight
original files, leaving existing identical inputs unchanged. Twelve tests passed,
including corrupted-direct-archive rejection without publishing any files.

Vercel CLI 62.7.0 was installed and its commands checked. Normal CLI deployment
remains an option on a developer machine with normal Vercel authentication. Codex
uses the scoped proxy-backed `VERCEL_TOKEN` through `api.vercel.com` instead;
do not copy or extract the credential into local CLI configuration. The existing
project/org IDs were discovered through authorized project access, and its
non-secret `.vercel/project.json` binding is Git-ignored.

The user wants existing **Production** environment bindings, not Preview:

```bash
# After securely authenticating and linking the EXISTING Vercel project:
vercel deploy --prod --skip-domain
```

This uses Production build/runtime variables but does not assign the live domain
yet. Check the resulting Production deployment URL, model inference and staff
session/CSRF before domain promotion. No Preview variables or external compute
host are needed for this procedure. Retain the read-only migration check; never
apply migrations or change production orders/inventory/payments during rehearsal.
Provider eligibility for Large Functions still must be checked/set as described
below. Any concrete production setting/promotion approval required by the original
request is obtained before applying it, after the candidate is reviewable.

A future Git-triggered build has no ignored archive. It must use an authorized
HTTPS bundle URL/checksum or be replaced by another direct upload from this
retained archive. Merging branches alone does not transfer the model. The original
archive is now in the private Vercel deployment source and was read back and
verified. Its subsequent authorized live-domain switch is recorded above.

## Current verified limits and remaining eligibility check

On 2026-10-10 Vercel's official documentation was reachable:

- [Python runtime](https://vercel.com/docs/functions/runtimes/python): standard
  uncompressed bundle limit 500 MB; no automatic Python tree-shaking.
- [Function limits](https://vercel.com/docs/functions/limitations): Hobby memory
  2 GB; Large Functions public beta permits up to 5 GB on Python with Fluid
  Compute and Active CPU enabled. Existing projects opt in using
  `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` as a project environment variable.

The tested inference container's Python packages occupy about 797 MiB, so the
supported-dependency candidate should use Large Functions rather than assume
the standard bundle will fit. Container package size is not an actual Vercel
build-size measurement. The Production-target test build now successfully enabled
Large Functions and reached READY on Hobby. Cold starts and authenticated hosted
predictions still require verification. Keep the existing free/Hobby plan and its usage limits; do not
upgrade or add paid compute/storage without approval.

## Prepared code

- Root `pyproject.toml`, which the supplied Vercel log showed is used for install,
  now declares the tested CatBoost/NumPy/pandas and supported runtime dependency
  versions. Training/scikit-learn/notebook packages are excluded.
- With `VERCEL=1`, `build.py` retains the read-only migration check, then downloads
  and checksum-verifies the existing archive through `deploy/provision_vercel.py`.
  No migration or training runs automatically.
- Provisioning stages eight files safely, checks every collision before copying,
  and refuses to overwrite existing inputs that differ. Verified inputs are
  placed in `backend/predictive_ai/{data,artifacts}`, Django's existing defaults.
- `vercel.json` explicitly includes those eight private function inputs and
  excludes local virtual environments/databases/tests. They are not React/public
  assets. CSVs and model artifacts remain Git-ignored.

## Git-triggered alternative and environment prerequisites

Use the existing project and `integration/dormathon-demo`. The user's current
choice is the Production-environment direct upload described above. The following
original Preview procedure remains an alternative only if the user later chooses
to configure Preview; Production bindings are not automatically shared with it.

1. Enable/verify Fluid Compute + Active CPU and set
   `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` in **Preview** environment settings.
2. Retain secure Django settings and provide a properly configured, migrated
   isolated Preview PostgreSQL database. The earlier supplied failed build had
   no valid PostgreSQL `DATABASE_URL` in Preview. Production and Preview bindings
   are independent; production's configured URL does not prove Preview has one.
   Do not migrate or alter production data to get a Preview build to pass.
3. Supply the existing evaluated archive through a secure server-side HTTPS
   `FRESHCAST_BUNDLE_URL`, with `FRESHCAST_BUNDLE_SHA256` set to
   `697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a`.
   The archive is still only at
   `/workspace/onboarding/preorder/predictive-bundle.tar.gz`; that path is not a
   browser download URL. A secure upload destination/method remains required.
   Use an existing authorized artifact store if available; no public frontend
   upload, Git commit or model retraining is a substitute. A temporary signed
   URL must remain valid during the build and be refreshed before later builds.
4. Leave `PREDICTIVE_DATA_DIR`/`PREDICTIVE_ARTIFACT_DIR` unset to use packaged
   defaults. Render's `/var/data` settings do not belong in this Vercel deployment.

For future agent-managed project inspection/deployment, retain `VERCEL_TOKEN`
securely in Codex environment settings scoped to `api.vercel.com`. Project/org
IDs can be discovered after access; they need not be required editor fields.
Never paste secret values into chat. Saving cloud settings is not deployment.
Manual Vercel dashboard configuration does not require providing Codex a token.

## Verification and promotion

Future releases should first use the Production-target candidate route with
automatic live-domain assignment disabled, retaining existing staff authentication
and CSRF. Verify all five predictive endpoints, center 13/week 146, four simulated
ingredient risks and the complete five-step assistant including a promotion POST.
Expect approximately 21,916.11 baseline orders and 49,246.95 scenario orders.
Retain external-history/SIMULATED/UNMAPPED labels and hypothetical-cost warnings.
Record the rollback deployment and obtain any authorization still required by the
active user request before promoting another release. The current release's
live-domain switch was authorized by the user's later request and completed as
recorded above; this does not authorize a main merge or production migrations.

The existing model hash remains
`b7608c307e17bb6d2b5b4ca15c4e495394cc405035de8c947522574da28b91a9`;
WAPE 28.23% versus 34.81% baseline. Twelve deployment/provisioning tests passed,
and the actual original archive passed the offline Vercel provisioning rehearsal.
Both subsequent Vercel builds reached READY. Authenticated hosted predictions
remain distinct from build/static-route checks and local real-model validation.

Existing GitHub CI on the prior 8e6df60 commit also reports a failed Django test
step; its log-download host remains blocked, so that failure is undiagnosed.
Do not count the local deployment suite as a passing full remote CI run.
