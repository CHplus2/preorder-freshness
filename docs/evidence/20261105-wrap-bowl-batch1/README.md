# Wrap & Bowl Kuch — batch 1 evidence

Captured 5 November 2026 from the local application after applying the exact
owner-run SQL in a disposable PostgreSQL 16 database. Desktop: 1366 × 1000;
mobile: 390 × 844. The store text, menus and public phone come from the supplied
poster/story. The original local food illustrations are placeholders, not
client food photos. Owner sign-in used a local fixture, never a live account.

- [Desktop menu](desktop-menu.png) and [mobile menu](mobile-menu.png): eight menu
  items, client categories, prices and weekday restrictions; no horizontal
  document overflow. The mobile navigation retains its existing compact brand
  treatment; the full brand is visible in kitchen details.
- [Founder story](desktop-founder-story.png): Ayu's supplied story rendered in the
  existing single-vendor design. No invented portrait.
- [Packaging stock](desktop-packaging.png) and [menu assignments](desktop-menu-packaging.png):
  nine standard packaging types, all active client menus assigned, no invented
  physical opening stock. Owner can use normal stock/assignment forms.
- [Browser results](browser-results.json): seven checks, zero uncaught errors.

Verification: 60 tests passed on real isolated PostgreSQL, including the
catalogue SQL, safe repeat, unit mismatch rollback, existing stock/history/bank
settings preservation, category counts, guest checkout and real local WebAuthn
signatures/concurrency. No PostgreSQL-only cases were skipped in this run.
Frontend `test:ux`, `test:recommendations`, `test:checkout`, `test:images`,
changed-component ESLint and production build passed. Existing large-main-chunk
build advisory remains.

The bulk promotion integration check verifies the threshold, food discount,
separate delivery fee, uploaded-proof amount, saved order and ingredient plus
packaging deductions. No real bank payment, SMTP email or courier booking was
made. The catalogue import itself deliberately does not change any order,
payment, existing stock count or promotion rule.

These are local implementation results. Supabase still requires the owner-run
import and Vercel must deploy the matching source. No live website/database state
is inferred from these screenshots.
