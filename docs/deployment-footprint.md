# Deployment footprint

The Supabase dashboard error `Failed to fetch (api.supabase.com)` concerns a
browser request to the management API. It does not identify a SQL error, database
password problem, or whether a previous SQL submission committed. Reopen the SQL
Editor and run `SELECT 1;` to test a new request. Before rerunning the operations
replacement, check its durable completion marker:

```sql
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM django_app.myapp_orderamendment
    WHERE after->>'operation_id' = 'wrap_bowl_operations_v1'
) THEN 'already_applied' ELSE 'not_applied' END AS status;
```

The replacement script also checks this marker and refuses to reset records a
second time. A failed browser request alone is not a reason to reset passwords,
delete migration records, or change database settings.

## Build and function boundaries

- `.vercelignore` omits development escrow contracts, tests and report evidence
  from build uploads. Two small starter JSON files remain available to existing
  management commands. Dependencies, local environments and Git history were
  already excluded.
- `vercel.json` also excludes original frontend photos, build scripts and React
  source directories from the Python function. These remain available during the
  frontend build. The generated `frontend/dist` remains in the runtime.
- The escrow verification manifest stays at
  `frontend/src/contracts/preorderEscrow.json`, where the server reads it.
  Existing portfolio source and historical payment handlers remain in Git.
- FreshCast's verified model, runtime inputs and original backup archive remain
  supported. No model or evaluation changes are part of this cleanup.

A local inventory found approximately 720 MB in the Python environment, 255 MB in
Node dependencies, 25 MB in built frontend files and 92 KB in the escrow folder.
These are local disk sizes, not measured deployed Vercel function sizes. The
Python dependencies are installed separately during deployment; excluding the
local virtual environment does not remove those runtime dependencies. Usage
across retained deployments and the live function output must be inspected in
Vercel before attributing its storage metric to any one directory. This change
does not reset already recorded usage.

Validation: the entrypoint test stages a reduced tree without development
sources, collects static assets, imports the actual WSGI application, serves the
menu/checkout pages and a built JavaScript asset, reads the escrow manifest, and
checks the disabled escrow configuration endpoint. Bundle provisioning tests
also preserve verified inputs and reject corruption. These checks do not replace
a successful Vercel deployment or prove that the live SQL replacement ran.
