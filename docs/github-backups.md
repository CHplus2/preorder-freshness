# FreshCast backups on GitHub

## Website and forecasting source

The current source is already committed to GitHub. Download it through GitHub's
**Code → Download ZIP**, or clone the repository. Workspace links in a Codex chat
are not a reliable substitute for a GitHub download.

- Current main: https://github.com/CHplus2/preorder-freshness/archive/refs/heads/main.zip
- Recover a specific revision using its GitHub commit page → Browse files.

Source downloads exclude kitchen database records and the ignored model bundle.

## Download the model using the website

After this feature is deployed, sign in with the existing staff account and open
**Settings → Advanced → Backups & recovery → Download Genpact model backup**. The download
uses the normal staff session; no deployment token or terminal is needed. Its
fixed archive and checksum are verified server-side and again in the browser.
The existing deployment-to-deployment bearer route remains protected separately.

The download is `freshcast-runtime-bundle.tar.gz`. It includes the original model,
metrics, three Genpact source CSVs and three explicitly simulated operation CSVs.
It does not contain kitchen database records, passwords or deployment credentials.
A missing/corrupt archive is an error; it is never replaced by a retrained model.

To keep that downloaded archive on GitHub, create a GitHub **Release** and attach
the file as a release asset, with its checksum. Binary release assets avoid
adding repeated archives to website source history. Release downloads persist
until the release/assets are deleted; GitHub Actions artifacts can expire.
Asset visibility follows repository visibility. The current session could not
read repository visibility or publish releases because GitHub's API returned 403.

The owner has published the original archive at
https://github.com/CHplus2/preorder-freshness/releases/tag/freshcast-model-backup-v1.
The reported asset checksum matches the pinned original checksum below.

## Automated original-model backup

1. In repository **Settings → Secrets and variables → Actions**, configure the
   existing deployment download credential as `FRESHCAST_BUNDLE_TOKEN`. Use secure
   settings, never chat or source code. This is not the Supabase password.
2. Open **Actions → Back up original Genpact model → Run workflow**, selecting
   `main` or `integration/dormathon-demo`.
3. Wait for success. The workflow downloads the existing original archive,
   checks its pinned SHA-256 and required files, creates a GitHub Release and
   downloads its asset back to verify the checksum. It never trains a model or
   connects to the kitchen database. Existing release assets are not overwritten.

The pinned original archive SHA-256 is:

```text
697f8e10ee6b2c1b794ee38ec81067477870315fb7c51a1280684e7f0601361a
```

The backup release tag is `freshcast-genpact-original-697f8e10ee6b`.
**A workflow file alone is not a completed model backup.** Only a successfully
published, downloaded-back and verified release establishes that backup.
The older `FreshCast downloadable demo bundle` workflow retrains a model and
produces a temporary artifact; that is a different recovery path.

Restore the saved original archive with `backend/predictive_ai/provision_bundle.py
--archive PATH --destination NEW_EMPTY_DIRECTORY`, setting
`FRESHCAST_BUNDLE_SHA256` to the verified checksum. Configure Django's
`PREDICTIVE_DATA_DIR` and `PREDICTIVE_ARTIFACT_DIR` to its extracted folders and
install the documented ML inference dependencies. No Vercel hosting is required.

## Kitchen records

Kitchen application exports contain private account and payment records,
including password hashes. Do not attach plaintext kitchen exports to a public
repository or release. Keep these in private backup storage, or encrypt them
before uploading to GitHub and store the decryption key separately. A model
backup release does not back up Supabase. See `freshcast-backup-restore.md` for
the logical export and isolated restore procedure.
