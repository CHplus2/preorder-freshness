# Direct FreshCast deployment on Vercel

The user wants a free demo on the existing Vercel site. Render is an unused
fallback; do not apply its paid Blueprint. No external compute host is required
if this Vercel project qualifies for the Large Functions path below.

## Verified deployment status: 2026-10-10

The original model-backed candidate is now **READY** on the existing Hobby project:
`https://preorder-freshness-7kxvk8uwe-heroch94-3036s-projects.vercel.app/admin/ai/decisions`
(deployment `dpl_Ba3dM3DM9RpavB5q9azYaBUPbgBb`, integration commit `7b190c3`).
The build verified all eight inputs and successfully enabled Large Functions beta
for the Python app. The public `preorder-freshness.vercel.app` alias still points
to its previous deployment; no custom-domain promotion occurred.

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
verified, while the public live-domain assignment remains unchanged.

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

Deploy the integration branch as a Vercel Preview. Confirm actual build package
size/eligibility and valid existing staff authentication + CSRF, then all five
predictive endpoints, center 13/week 146, four simulated ingredient risks and
the complete five-step Decision Assistant including a promotion POST. Expect
baseline total approximately 21,916.11 orders and scenario total 49,246.95.
Retain external-history/SIMULATED/UNMAPPED labels and hypothetical-cost warnings.
Only then provide the exact Preview URL, results, production-setting differences
and rollback deployment to the user for the approval required by their original
deployment request. No production settings or deployment were changed here.

The existing model hash remains
`b7608c307e17bb6d2b5b4ca15c4e495394cc405035de8c947522574da28b91a9`;
WAPE 28.23% versus 34.81% baseline. Eleven deployment/provisioning tests passed,
and the actual original archive passed the offline Vercel provisioning rehearsal.
This is not proof of a successful hosted Vercel deployment.

Existing GitHub CI on the prior 8e6df60 commit also reports a failed Django test
step; its log-download host remains blocked, so that failure is undiagnosed.
Do not count the local deployment suite as a passing full remote CI run.
