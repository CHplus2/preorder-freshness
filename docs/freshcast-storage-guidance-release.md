# Reusable storage guidance release

Implementation branch: `release/raw-material-guidance`.
Pre-release production/integration baseline: `332b530`.

Release status: the owner confirmed the migration result on 27 October 2026.
Main and integration can advance together to the tested implementation
`2f01137` and this release record. Production database access and live deployment
health were not independently verified from the managed coding environment.

This release adds optional, owner-documented receipt-based storage references
to raw materials. It does not seed food-storage durations, assess physical food
safety, change existing stock dates, retrain forecasts or connect a courier API.

## Apply the database change first

1. Keep a private backup of the target database. Do not commit the backup or its
   connection credentials to GitHub.
2. In Supabase SQL Editor for the existing project, run the **whole** file
   [`deploy/sql/0023_raw_material_storage_guidance.sql`](../deploy/sql/0023_raw_material_storage_guidance.sql).
   It explicitly targets the existing `django_app` schema, requires migration
   `0022_menu_photo`, and adds only `myapp_rawmaterial.storage_guidance`.
3. The result must show `0023_raw_material_storage_guidance`. The DO block is
   transactional, uses a lock timeout, and verifies column shape on a repeat run.
   Existing ingredients start with `[]`; inventory quantities/dates are untouched.
4. Confirm that result before advancing main and integration together to this
   release. The Vercel build's existing read-only migration check stays enabled.

Alternatively, a connected deployment terminal checked out at this release can
run `python backend/manage.py migrate` with its existing secure connection and
`DATABASE_SCHEMA=django_app`, followed by `python backend/manage.py migrate --check`.
Do not reset credentials or paste connection strings into messages for this step.

The managed coding environment has no permitted Supabase TCP connection, so the
production migration is not claimed to have been applied here. Keep both public
production branches on the baseline until it is confirmed. The extra column is
compatible with the old code while waiting. If a code rollback is needed, keep
the additive field and its evidence rather than deleting saved references.

## Owner workflow after deployment

Inventory → Ingredient directory → Edit (or Add ingredient) → Reusable storage
guidance. Add a storage type, documented whole days from receipt, source and
matching ingredient state/temperature/handling conditions; or leave it empty.

When recording stock, choose the ingredient and actual storage. Review the
matching reference, then choose **Use this guidance for this batch** to copy it.
This changes the current form only. Review its deadline and save the batch.
Custom documented values remain available without a material reference. A
frozen reference is never offered for chilled storage. Earlier recorded limits
and handling holds continue to apply. Reference edits do not recalculate older
stock; review individual batch evidence separately.

The FoodSafety.gov chart link is general reference material to review for the
actual ingredient and conditions. No specific duration is automatically fetched,
validated or inserted by this release.
