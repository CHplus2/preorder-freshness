# Isolated FreshCast Render preview

The user selected Render. `render.yaml` is a **candidate Blueprint**, not an
already-created deployment. It runs the complete existing Django + React app
from `integration/dormathon-demo`; the Decision Assistant is at
`/admin/ai/decisions`. No Vercel settings or production data are changed.

## Review before creating resources

The measured container used about 585 MiB. The candidate requests Render's
`standard` plan (target at least 2 GB RAM) and a 1 GB persistent disk. **Confirm
the current memory allocation and service/disk charges in Render before applying
it.** Render's current documentation/API could not be accessed from this cloud
task: HTTPS CONNECT returned proxy HTTP 403. The YAML parses locally; Render's
own Blueprint validation, account eligibility and pricing are still unverified.
Creating this paid service needs the user's approval of the displayed charges.

Only the demo's new SQLite file lives on this disk. No existing database URL is
needed. This single-worker persistent-disk configuration is suitable for a small
hackathon rehearsal, not a production scaling recommendation. Deleting the disk
loses its contents; retain an independently accessible copy of the bundle.

## Prerequisites

1. A Render account/workspace with access to this GitHub repository.
2. An approved paid service/disk plan with adequate memory.
3. A secure way to transfer the **existing** evaluated runtime archive. The
   archive currently exists only at
   `/workspace/onboarding/preorder/predictive-bundle.tar.gz` in Codex. This path is
   not a download URL. Do not start a GitHub training workflow to replace it.
   An access-controlled HTTPS artifact URL, entered only into Render's
   `FRESHCAST_BUNDLE_URL` server-side environment setting, supports the candidate's
   automatic download. No upload destination is currently configured. Account
   access and an authorized upload method are required before Codex can transfer
   it. Never place the archive in React/public assets or commit it to Git.

The required archive SHA-256 is
`697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a`.
It contains the three historical CSVs, three simulated CSVs, the trained model
and metrics. The model SHA-256 must remain
`b7608c307e17bb6d2b5b4ca15c4e495394cc405035de8c947522574da28b91a9`.

For agent-managed creation, supply `RENDER_API_KEY` securely in Codex environment
settings, scoped to `api.render.com`, and set the non-secret `RENDER_OWNER_ID`
to the intended workspace/account owner. Review/save/publish the saved network
draft allowing Render's API, dashboard, documentation and preview hostnames.
These settings do not create any Render resources. Manual setup in the Render
dashboard does not need an API key in Codex.

## Create the isolated preview after prerequisites are satisfied

1. In Render, create a new Blueprint from `CHplus2/preorder-freshness`, explicitly
   selecting **integration/dormathon-demo** and the root `render.yaml`.
2. Inspect the plan, persistent disk and displayed charges before applying.
   Supply the secure archive URL when prompted for `FRESHCAST_BUNDLE_URL`.
   Do not supply your Vercel/production database URL or production SECRET_KEY.
3. Render builds `deploy/Dockerfile`. It bundles the existing React build and
   installs Django/CatBoost dependencies. Startup verifies the archive digest
   and provisions it once into the versioned `/var/data/bundle-...` directory.
   The disk survives container rebuilds. An expired URL must be refreshed if
   provisioning is needed on a new disk; a nonempty destination is not overwritten.
4. The service starts without running migrations or training. `/` is a liveness
   check for the React shell, **not proof that login or prediction APIs work**.
5. Open the service's Render Shell and initialize only its guarded demo database:

   ```bash
   python manage.py check
   python manage.py migrate --noinput
   python manage.py createsuperuser
   python manage.py migrate --check
   ```

   `config.render_preview_settings` refuses any database URL other than
   `sqlite:////var/data/freshcast-demo.sqlite3`, restricts allowed hosts to the
   Render-generated hostname plus local health checks, and enables secure
   session/CSRF cookies. Keep the staff password private. Email is in-memory;
   do not configure real payment or notification provider credentials.
6. Copy the **actual URL shown by Render**. Open that URL, log in through the
   existing FYP login, and navigate to `/admin/ai/decisions`. Its landing page can
   still show the FYP home; the FreshCast navigation is available to staff.

## Acceptance checks before sharing with judges

- Select Live API, center 13 and week 146. Check browser Network responses for
  metrics, centers, forecast and inventory-risk; each must be HTTP 200.
- Check model WAPE 28.23% versus the 34.81% historical baseline and real forecast
  total approximately 21,916.11 orders. Source labels must show historical demand,
  **SIMULATED** operations and **UNMAPPED** products. Five recipe meals are covered;
  46 forecast meals lack recipes and are explicitly warned about.
- Select rice, navigate all five steps, enter worksheet assumptions, and run the
  promotion comparison. `POST /api/admin/predictive/what-if/` must return 200 with
  valid session + CSRF, preserve the selection, and show approximately 49,246.95
  total scenario orders. This toggles both promotion flags with prices/history
  fixed; it is not a causal uplift estimate or a stock/price editing endpoint.
- Verify mobile layout, loading/error states and an anonymous/invalid-CSRF request
  being refused. Never count a fixture response as live inference.
- Restart/redeploy the service and verify disk/database/bundle retention and all
  five endpoints again. Preserve the exact successful hosted URL and logs.

The existing container passed these flows locally, but **Render-hosted checks
have not run**. Do not promote to the Vercel production domain until the hosted
preview passes and the user approves the concrete production change/rollback plan.
