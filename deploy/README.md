# FreshCast deployable candidate

This deploys the **existing Django app and built React UI**, preserving sessions,
CSRF, staff authorization and the v1 predictive contract. No model training or
migration runs on startup. Existing production Vercel settings remain unchanged.

The user now wants a free demo directly on Vercel. See [VERCEL.md](VERCEL.md)
for the current deployment candidate and newly verified Large Functions limits.
[RENDER.md](RENDER.md) and the root `render.yaml` remain an unused paid fallback;
do not apply that Blueprint. No hosted service or production promotion was created.

## Diagnosis and hosting choice

The live `source_data_unavailable` error means the three historical files are
absent from configured runtime paths. Git ignores model/data; the production
requirements do not install ML packages; no bundle provisioning occurs in the
existing Vercel build. The earlier supplied failed-build log had a separate,
confirmed missing/invalid PostgreSQL DATABASE_URL in Preview.

The local Django/training runtime measures about 713 MB of installed packages.
Training-only scikit-learn and notebook helpers are excluded here. CatBoost
requires SciPy, NumPy, pandas and plotting dependencies by its package metadata;
we retain supported dependencies instead of bypassing requirements or disabling
verification. A local Gunicorn worker with model/history loaded measured about
393 MiB RSS. Exact Vercel packaging limits and deployment plan/size remain
unverified because docs/API/live-site destinations returned proxy HTTP 403.
Do not label the current package Vercel-compatible until its actual build passes.

A container-hosted Django candidate avoids depending on an unverified serverless
package fit. Start with one worker, two threads, and a host with about 2 GB memory
for headroom, then measure real concurrency. The React UI is built into the same
image and served by Django/WhiteNoise; there is no new login or FastAPI service.
For an eventual split frontend, preserve same-origin browser requests with a
reviewed Vercel reverse-proxy configuration; no such production routing change
is applied here. A complete application preview on the container host is the
simplest way to validate authentication before deciding production routing.

## Bundle provisioning without retraining

Required eight runtime files are listed in
`backend/predictive_ai/provision_bundle.py`. The existing evaluated archive is
available in this workspace; it is **not uploaded to external storage**. Put the
archive into access-controlled artifact storage and retain its SHA-256 digest.
The URL can be a secure signed URL stored in the host's server-side environment;
never commit it or put it in a VITE variable. Signed URL lifetime must permit
future cold starts, or use a persistent mounted bundle with controlled refresh.
The URL is not logged by the provisioner. TLS/checksum verification remains on.

For a read-only bundle mount, set `PREDICTIVE_DATA_DIR` and
`PREDICTIVE_ARTIFACT_DIR` to its mounted directories. For secure startup download,
set `FRESHCAST_BUNDLE_URL` (HTTPS) and `FRESHCAST_BUNDLE_SHA256`. Files are written
to a digest-versioned `/tmp` directory unless a root is explicitly configured.
Provisioning happens during process startup, never inside an HTTP request.
A destination containing existing files is not overwritten. Unsafe archive
paths/links, duplicate names, missing files and checksum mismatches fail closed.
Model/data never enter frontend static assets or Docker build context.

A GitHub Actions artifact may be used after verifying successful execution,
authenticated download and checksum, but its 30-day retention makes it a transfer
source rather than a permanent production artifact store. The earlier workflow
regenerates the model and is not proof that the exact current model was exported.
This task does not dispatch that workflow or retrain.

## Build and safe preview

```bash
docker build -f deploy/Dockerfile -t freshcast-dormathon:preview .
```

For corporate/cloud HTTPS interception, the optional BuildKit secret
`--secret id=build_ca,src=/absolute/path/to/approved-ca.pem` supplies the approved
CA only to dependency-install steps. It is not copied into the image. Do not use
TLS-verification bypasses. In this Codex instance Docker also required the
provided egress proxy's address mapping and proxy build arguments; ordinary hosts
do not normally require those overrides.

Provision the existing bundle outside the checkout:

```bash
FRESHCAST_BUNDLE_SHA256=<verified-archive-sha256> \
  python backend/predictive_ai/provision_bundle.py \
  --archive /secure/path/runtime-bundle.tar.gz --destination /secure/path/bundle-v1
```

Create a **new isolated preview database** and local staff account explicitly,
using the established demo guide. For a local container demo only, mount that
SQLite database directory and the verified bundle; set a preview-only SECRET_KEY,
DEBUG=False, ALLOWED_HOSTS=localhost,127.0.0.1 and in-memory email:

```bash
docker run --rm -p 8005:8000 \
  --env-file /secure/path/preview.env \
  -v /secure/path/bundle-v1:/bundle:ro \
  -v /secure/path/demo-state:/state \
  -e PREDICTIVE_DATA_DIR=/bundle/data \
  -e PREDICTIVE_ARTIFACT_DIR=/bundle/artifacts \
  -e DATABASE_URL=sqlite:////state/demo.sqlite3 \
  freshcast-dormathon:preview
```

The environment file belongs outside Git and supplies preview settings only.
A hosted preview needs its own persistent database, server-side settings and a
staff account managed securely. Do not copy or overwrite existing production
settings. Rehearsal must not use production orders/inventory/payments.

Open `/admin/ai/decisions` on the preview host, log in through the existing FYP
screen, select Live API and center 13/week 146, then verify all five endpoints,
FEFO evidence, guided steps, worksheet and promotion POST. Assert source labels
remain external/SIMULATED/UNMAPPED and no fixture fallback occurs.

## Promotion is a separate approval step

Before promoting to `preorder-freshness.vercel.app`, provide the successful
preview URL, endpoint/browser results, exact routing/hosting/settings changes,
rollback plan and artifact version, and obtain the user's approval. This task
explicitly forbids automatic production configuration changes. A new container
host or storage account requires access supplied securely, never credentials in
chat. No production database migration is part of this candidate.

## Results from this workspace

The Docker image built successfully with full TLS verification and the supplied
approved CA mounted as a build secret. Its Python site-packages measured about
797 MB; this is not a Vercel function-size validation. The running container used
about 585 MiB RAM during the representative walkthrough. Its model/data bundle
was mounted read-only from `/tmp/freshcast-deploy-verified`, provisioned from the
existing evaluated archive using checksum
`697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a`.
The model SHA-256 remains
`b7608c307e17bb6d2b5b4ca15c4e495394cc405035de8c947522574da28b91a9`.

The actual container passed staff-session Chromium tests: all five predictive
endpoints HTTP 200, guided five-step ingredient selection, hypothetical worksheet,
real promotion POST, retained selection/recommendation, forecast/inventory views,
390px layout, loading recovery, unsupported-center error and anonymous gate. No
JavaScript runtime errors or fixture fallback. Seven repository/provisioning tests
also passed. No retraining took place.

The live Vercel site and API/GitHub logs remain unreachable through the current
cloud egress policy. Required custom host additions were saved in the cloud
environment draft: `api.github.com`, `api.vercel.com`, `vercel.com`, and
`preorder-freshness.vercel.app`. Review/save and publish that cloud environment
configuration, then retry access. This draft is unrelated to production Vercel
settings and does not deploy anything. Hosting credentials and an artifact-store
upload route are still required to create a hosted preview. Until then the live
five-endpoint tests, browser flow and production readiness remain unverified.
