# Direct FreshCast deployment on Vercel

The user wants a free demo on the existing Vercel site. Render is an unused
fallback; do not apply its paid Blueprint. No external compute host is required
if this Vercel project qualifies for the Large Functions path below.

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

Vercel CLI 62.7.0 was installed and its commands checked. `whoami` reports logged
out; `deploy --dry` reports no existing credentials. Thus the actual CLI upload
selection, project link, build and deployed inference remain unverified. Codex
GitHub authentication does not supply Vercel account access. Provide a scoped
`VERCEL_TOKEN` securely in Codex environment settings, not chat. Once connected,
inspect the existing project/plan/settings and link it; do not create a new paid
project or overwrite credentials. Project/org IDs can be discovered after access.

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
retained archive. Merging branches alone does not transfer the model. No archive
has yet left this workspace and no deployment/domain change occurred.

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
build-size measurement. Project eligibility, actual function packaging, cold
starts and authenticated hosted predictions still require a Vercel Preview
build/test. Keep the existing free/Hobby plan and its usage limits; do not
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

Codex has no working Vercel account credentials or project binding currently.
For agent-managed project inspection/deployment, supply `VERCEL_TOKEN` securely
in Codex environment settings scoped to `api.vercel.com`, plus non-secret
`VERCEL_PROJECT_ID` and `VERCEL_ORG_ID`. Never paste secret values into chat.
Secure requirements were saved in the cloud draft; saving is not deployment.
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
