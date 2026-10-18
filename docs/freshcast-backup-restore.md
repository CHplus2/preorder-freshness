# FreshCast backup and restore

The code, kitchen database and Genpact runtime bundle are separate components.
A source archive alone does not contain kitchen records or the trained model.

## Create a private application backup

Use the existing PowerShell terminal whose `DATABASE_URL` connects successfully
to your Supabase database. From the repository root:

```powershell
.\backend\venv\Scripts\python.exe scripts/backup_freshcast.py
```

The tool defaults `DATABASE_SCHEMA` to `django_app` only if it is unset. It uses
the current Python environment and connection; it does not print credentials,
change records, migrate or retrain. No PostgreSQL client installation is needed.
It creates a new directory under your private `FreshCast-backups` user folder.
Keep a second private copy outside that computer or cloud workspace.

Components:

- `source.bundle`: committed Git history/refs. Uncommitted and ignored files are
  not included; `working_tree_clean` reports whether unsaved work was detected.
- `kitchen/kitchen.json.gz`: Django-managed application records and relationships,
  including users, menus, orders, payment records, recipe snapshots, stock, plans
  and audit data. IDs and demo provenance are preserved. PostgreSQL exports use
  one repeatable-read, read-only transaction.
- `genpact-runtime.tar.gz`: the **existing** trained Genpact model, metrics and six
  input CSVs. Its full archive checksum and required contents are verified before
  copying. No new model is trained.
- `manifest.json`, `SHA256SUMS`, `RESTORE.md`: component status, hashes and guidance.

Exit code **0** means all three application components were backed up. Exit code
**2** means **partial backup**; inspect the component statuses. A valid kitchen
export is still retained if the model archive is unavailable. Existing backups
are never overwritten.

The Genpact archive is detected at `.freshcast-deploy/runtime-bundle.tar.gz` or
`backend/predictive_ai/artifacts/runtime-bundle.tar.gz`. An explicit local copy can
be provided:

```powershell
.\backend\venv\Scripts\python.exe scripts/backup_freshcast.py --model-archive "C:\Private\runtime-bundle.tar.gz"
```

Alternatively configure `FRESHCAST_BUNDLE_URL`, `FRESHCAST_BUNDLE_TOKEN` and the
expected `FRESHCAST_BUNDLE_SHA256` securely. These are separate deployment bundle
settings, not the database password. Credentials are never saved in manifests.
The current original bundle checksum is pinned in
`backend/predictive_ai/provision_bundle.py`. The protected source is documented in
`deploy/VERCEL.md`; a separate source deployment is still a Vercel dependency
until an independent archive has been saved.

## Scope and privacy

This is an **application logical backup**, not a full Supabase project or physical
PostgreSQL backup. It excludes Supabase auth/storage schemas, custom SQL objects,
database roles, external media and environment secrets. Back those up separately
through the relevant provider. Image URLs are records; remote image bytes are
not downloaded. Sessions are deliberately excluded; users sign in again after
restoration. Content types and permissions are recreated by Django migrations.

The kitchen fixture contains private records and password hashes. Keep it out of
Git, public uploads, frontend assets and shared folders. File permissions are
restricted on POSIX; on Windows use a private user folder. Store deployment
credentials separately in your password manager or secure environment settings.

## Verify and restore into an isolated environment first

1. Verify every entry in `SHA256SUMS` before use. In PowerShell, use
   `Get-FileHash -Algorithm SHA256` for each named file. The kitchen subdirectory
   has its own checksum manifest too.
2. Restore source with `git clone source.bundle freshcast-restored`. Switch to the
   commit recorded in the source component's manifest. Install its exact project
   dependencies (`pyproject.toml` and `frontend/package-lock.json`).
3. Configure a **new empty isolated database**, its schema and a local secret key.
   Do not point restore commands at your live Supabase project.
4. From that restored checkout, with its Python environment active, run:

   ```text
   python backend/manage.py migrate --noinput
   python backend/manage.py loaddata /private/backup/kitchen/kitchen.json.gz
   python backend/manage.py check
   ```

   Use your actual backup path. Compare model counts with
   `kitchen/manifest.json`, check recipes, accepted plans, payment records and
   inventory. An existing database is not a safe restore target: `loaddata` can
   overwrite records with matching IDs. Never run it merely to test production.
5. Provision the saved Genpact archive into a **new empty** directory using
   `backend/predictive_ai/provision_bundle.py --archive ... --destination ...`,
   with `FRESHCAST_BUNDLE_SHA256` set to the saved verified checksum. Configure
   `PREDICTIVE_DATA_DIR`/`PREDICTIVE_ARTIFACT_DIR` to that directory's `data` and
   `artifacts` folders. Install the documented ML inference dependencies.
6. Test staff-only kitchen decisions and Genpact forecasts in the isolated app.
   A checksum/JSON check confirms backup integrity; it is not a full production
   restore rehearsal. Kitchen forecasting uses the restored history automatically.

No automated production restore is provided. Changing production records is a
separate reviewed release operation.
