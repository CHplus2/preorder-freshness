# Passkey account release prerequisite

Release update — 4 November 2026: the owner confirmed running the SQL script.
The prepared application source is `4be9c09`, following prerequisite `8cdf40c`.
It can now be published to `main`; a successful Vercel deployment still needs to
be observed. The production migration result is owner-reported, not a direct
production database inspection by this environment.

The procedure below records the release sequence: SQL prerequisite first,
matching application second. This keeps Vercel's read-only migration release
check intact.

1. Keep a private recovery copy of the target database using your normal backup
   process. Do not post credentials, database dumps or bank images to GitHub.
2. Open the [complete 0027 SQL file](https://github.com/CHplus2/preorder-freshness/blob/main/deploy/sql/0027_customer_passkeys.sql),
   select **Raw**, and copy its entire contents into Supabase → SQL Editor for
   **Preorder and Freshness**, the same database with the `django_app` schema.
3. Run the whole script. The final result must show `0027_customer_passkeys`.
   It requires `0026_guest_qr_fulfilment`, creates three private tables with RLS,
   verifies their constraints, and records completion only when it succeeds.
   Rerunning the complete script verifies the recorded schema. Do not disable
   RLS, insert a migration record separately, or use fake migrations.
4. Share only the migration name/result. The prepared application can then be
   pushed to `main`. No terminal, password reset, integration branch update or
   database downgrade is needed for this SQL Editor route.
5. After the application deploys Ready, test on the stable production domain:
   browse → add food → checkout → create account → choose time/payment → order.
   Sign out and use **Account → Sign in with a passkey** to load the same orders.
   Existing staff/legacy password-authenticated customer sessions remain valid.

The default production origin uses trusted `PUBLIC_APP_URL` or Vercel's production
metadata; otherwise it uses `https://preorder-freshness.vercel.app`. If you use a
custom domain, configure `PASSKEY_ORIGIN` as that exact HTTPS origin before
registering keys. Preview domains need their own explicit origin and independent
passkeys. Changing domains does not move already-created passkeys. Never use an
untrusted request Host as the origin setting. For development served by Django,
use `http://localhost:8000`; for Vite, set `PASSKEY_ORIGIN=http://localhost:5173`.

Customer passkeys need a supported browser/device and screen lock or security
key. Other devices need a synced key, registered backup or supported cross-device
browser flow. Keep a backup in the customer's passkey manager. Name/phone are
contact details and cannot recover access to another person's account. The
website never receives fingerprints, face data, device PINs or private keys.
A phone number does not subscribe a customer to email, SMS or WhatsApp.

Local Python environments need the new pinned `webauthn==2.7.0` dependency (also
listed in the runtime requirements); Vercel installs it from `pyproject.toml`.
Production database application and a Ready deployment have not been observed by
the coding environment; successful local checks do not establish those facts.
