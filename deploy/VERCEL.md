# Direct FreshCast deployment on Vercel

The user wants a free demo on the existing Vercel site. Render is an unused
fallback; do not apply its paid Blueprint. No external compute host is required
if this Vercel project qualifies for the Large Functions path below.

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

## Prerequisites in Vercel's Preview scope

Use the existing project and `integration/dormathon-demo`; a Preview deployment
on Vercel tests the same hosting platform before production promotion.

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
