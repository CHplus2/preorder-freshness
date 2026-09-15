# Vercel + Supabase deployment

## Architecture

One Vercel Django project serves the built React app and `/api/` on the same origin. This avoids third-party session-cookie problems. React assets are built to `/static/`; Vercel serves collected Django static files from its CDN. Deep links such as `/story`, `/menu` and `/admin/planner` load React. Django’s native admin lives at `/django-admin/`.

SQLite remains a local development fallback. Vercel requires `DATABASE_URL` pointing to persistent PostgreSQL. No API key is used to connect Django’s ORM to PostgreSQL.

## 1. Prepare Supabase

1. Open your active project, choose **Connect**, and copy the PostgreSQL connection URI.
2. Prefer the **Transaction pooler** for serverless requests, or the **Session pooler** for migrations and IPv4 access. Direct database hosts can require IPv6.
3. Replace the password placeholder with your database password. URL-encode special characters in the password (`@` → `%40`, `%` → `%25`). Do not double-encode an already encoded password.
4. Store the URI only in backend `.env` locally and Vercel environment variables. Never put it in frontend code or a `VITE_` variable.
5. If Django tables are in a Supabase API-exposed schema, disable the unused Data API or remove that schema from its exposed schemas. Django connects privately through PostgreSQL and enforces its own authenticated API permissions; it does not need the Supabase Data API.

## 2. Set Vercel variables

Import `CHplus2/preorder-freshness` with **Root Directory `.`**, **Django** framework preset, and build command `python build.py`. Do not choose the frontend directory as the Vercel project root. Python is pinned to 3.13. `vercel.json` and `pyproject.toml` contain the entrypoint and build settings.

Required environment variables:

- `DATABASE_URL`: Supabase PostgreSQL URI, ideally transaction pooler for serverless traffic.
- `DATABASE_SCHEMA`: `django_app` when using the private schema prepared below. Use the same value locally and on Vercel.
- `SECRET_KEY`: a newly generated long random Django secret; keep it stable across deployments.
- `DEBUG`: `False`.
- `ALLOWED_HOSTS`: any custom hostname(s), separated by commas. Vercel’s deployment and production hostnames are automatically added from its system environment variables.
- `CSRF_TRUSTED_ORIGINS`: full HTTPS custom origins, separated by commas, if you use a custom domain. Vercel-generated origins are added automatically.

Keep the variables server-side. Do not set `SUPABASE_DATABASE_URL` alone in Vercel: the application reads `DATABASE_URL`. The separate local variable is used to verify a new connection without replacing the working local database prematurely.

## 3. Initialise the remote database explicitly

Migrations do **not** run automatically on every build or request. Preview deployments must not unexpectedly alter a production database.

For a first transfer of your existing local data, keep `DATABASE_URL` unset, set the session pooler URI in the private `SUPABASE_DATABASE_URL`, and run:

```powershell
backend/venv/Scripts/python.exe manage.py migrate
backend/venv/Scripts/python.exe manage.py prepare_supabase
```

This explicitly uploads local accounts, addresses, orders, inventory and menu data to your Supabase project. Use it only when you intend that transfer. It creates a private `django_app` schema with no `anon` or `authenticated` schema access, keeps an ignored local JSON backup, excludes browser sessions and the local UI QA account, and refuses to overwrite a populated `django_app` schema. If interrupted after migrations, inspect the remote state before retrying; it will not overwrite it automatically. The existing SQLite file remains available.

After a successful transfer, set `DATABASE_URL` to your pooler URI and `DATABASE_SCHEMA=django_app`, then restart the backend. Do not expose `django_app` through the Supabase Data API.

After validating the connection and selecting the intended Supabase database, set your local shell’s `DATABASE_URL` from the ignored environment file, then run:

```powershell
backend/venv/Scripts/python.exe manage.py migrate
backend/venv/Scripts/python.exe manage.py createsuperuser
```

Create a new owner only if you are starting with an empty database. To retain local accounts and orders, migrate the local fixture into an empty remote database instead, using a private export that excludes content types, permissions, sessions and admin logs. Do not commit the export. Never import blindly over an existing populated database.

## 4. Verify after deploying

- Open Home, Our Story, Menu, How It Works and Contact directly by URL.
- Check CSS, JavaScript and favicon load from `/static/`.
- Sign in, add a menu item, refresh, and confirm the cart persists.
- Place a test preorder and verify owner-only pages reject customer accounts.
- Configure actual owner story, portrait, service area and contact channels in Brand & settings.
- Confirm production uses PostgreSQL, not a local `.sqlite3` file.
- Save a delivery address, leave checkout and return: it should be reused. Edit it and confirm past orders retain their original delivery details.

## Testnet escrow

`/escrow-demo` is an academic Sepolia demonstration, separate from production orders. See [escrow setup and limitations](escrow/README.md). Deploy the included contract with your own test wallet and enter its address in the demo, or set the public `VITE_TESTNET_ESCROW_ADDRESS` before building. No private wallet key is required or accepted by the app. The included contract cannot be deployed on mainnet.

The code has local build and backend regression checks. Successful Vercel deployment and remote database migration require a reachable Supabase connection and configured Vercel variables; a GitHub push alone does not complete those steps.

## Credential handling

The connection string and API key supplied in chat are not committed. Rotate those credentials in Supabase because they have been shared in a conversation, then update only the private environment variables.

## References

- [Django on Vercel](https://vercel.com/docs/frameworks/full-stack/django)
- [Vercel SQLite limitations](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
