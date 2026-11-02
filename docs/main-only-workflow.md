# Main-only development and frozen FYP baseline — 2 November 2026

The owner explicitly requested a one-time integration rollback, followed by all
future work on main. This replaces the previous integration-only routing in
AGENTS.md.

| Branch | Purpose |
| --- | --- |
| `main` | Current client implementation and all future changes |
| `integration/dormathon-demo` | Read-only FYP application baseline |
| `report/fyp2-2026-10-29` | Existing report/diagram snapshot, unchanged |
| `feature/ai-backend`, `feature/ai-dashboard` | Existing developer branches, unchanged |

The report evidence manifest and chapters 4/5 cite website source
`ab1a97684dbf5d8b992b9f74fd07580b59d4636d`. The integration rollback is a new
forward commit, `693e1edb8bad741c91b78b2687674b1a91e2a870`; its application tree
matches that baseline exactly. Only AGENTS.md differs to record the new policy.
Shared history was not force-rewritten. This was the final integration push.

The client feature commits `1626b9e`, `546fe68`, `c512eaf` and `8e8a2b1` are
preserved in main's ancestry. Main was created locally from the latest client
commit before the integration rollback, so the rollback is not applied to main.
The previous remote main already existed at `ab1a976`; the source update is a
normal fast-forward. Branch-routing and release documentation are updated there.

## Database and deployment

This is a code-branch rollback, not a database downgrade. The owner confirmed
0024–0026 appear in Supabase. No production database writes, migration record
removals, stock changes or payment actions were performed for this branch update.
The additive columns retain DB defaults for old-code inserts, as tested in the
client release evidence. The FYP code does not expose the new client tables.

The supplied Vercel failure was for integration commit `8e8a2b1`. Django settings
raised `ImproperlyConfigured: Set a PostgreSQL DATABASE_URL in Vercel. Local
SQLite is not persistent there.` That deployment had no usable PostgreSQL URL;
it failed before querying migration state. The outer generic release-check error
is not evidence that the confirmed Supabase migrations need running again.

Preview configuration is separate from Production. When main is the configured
Production Branch, a new main push uses that environment's configuration and
should trigger a Production build. Source publication does not establish Ready
status. This workspace has no Vercel deployment credentials, so live deployment
status must be checked in Vercel. Do not remove the database/model integrity gates
or print environment secret values to make a build pass.

## Validation

- Restored integration application/index tree compared with the report baseline:
  only AGENTS.md differs after commit.
- Restored baseline backend: 829 discovered, 804 passed and 25 skipped (external
  runtime/PostgreSQL prerequisites); frontend unit checks, lint and build passed.
- Main client implementation remains the previously tested `8e8a2b1` application
  tree, apart from branch/release documentation. Its detailed client and QR
  evidence remains in the repository. No forecasting model or artifact changed.
- FYP report branch remains at `b515973bc44be39518b5385095e5bc7e46981448`.
