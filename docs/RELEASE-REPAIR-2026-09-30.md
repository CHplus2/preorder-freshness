# Database release repair — 30 September 2026

The Vercel application code included Stage 1 features while its configured PostgreSQL schema still lacked migrations 0015 and 0016. Orders and guided recommendations depend on those additions. The saved local and Vercel database configurations were confirmed to target the same database and application schema.

With the user's authorization, the `django_app` schema was backed up into an ignored local custom-format archive before migration. Existing schema tables were write-locked during backup and migration, and both migrations ran within one transaction. The archive was checked with `pg_restore --list`; a full restore rehearsal was not performed.

- Backup: `backend/backups/pre-stage1-release-20260930T055741Z.dump` (not committed).
- SHA-256: `9e5851a06131188265db27c130148e3fccee016911262fae082867010ae41014`.
- All 20 existing order IDs, totals, delivery fees, statuses and payment statuses matched before and after.
- Migrations 0015 and 0016 committed successfully; no migrations remained pending.
- Admin order API invoked against this PostgreSQL database returned HTTP 200 and 20 orders.
- Guided recommendation API returned HTTP 200 and one suggestion for a date seven days ahead. Its test telemetry was rolled back.

These are backend checks against the deployed database using local application code, not a claim of a completed browser test through Vercel. The original error reference was not retrieved from Vercel logs.

The order screens now distinguish loading, request failure and an actual empty list, with a Retry button on failure. Vercel builds run `migrate --check` before building assets and fail if the schema is behind. This is read-only: future schema releases still need a backed-up, verified migration before deployment. Local builds do not connect to the database for this check.

Earlier stage documents describe what was verified at implementation time; their statements that Stage 1 migrations were outstanding are superseded by this repair record.
