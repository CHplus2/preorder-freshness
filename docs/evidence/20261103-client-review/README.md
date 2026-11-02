# Final client review evidence — 3 November 2026

Source: main based on 356ea0f, plus the final review changes in this commit.
The FYP report and integration branches were not edited. There is no migration
or forecasting/model change in this batch.

- Full isolated SQLite backend run: 921 discovered, 891 passed, 30 skipped.
  Skips require PostgreSQL or absent external runtime artifacts, not passes.
- Separate isolated PostgreSQL 16 selection: 88 passed, no skips. Includes real
  competing stock allocations, checkout retries and duplicate receipt-image locks.
- Focused SQLite client/report/guest/simple-ordering selection: 62 passed.
- Frontend unit/SSR, UX, checkout and recommendation suites, lint and production
  build passed. The existing main-bundle size advisory remains.
- Chromium: desktop 1440×1000 and mobile 390×844. See browser-results.json for
  observed flows, plus the separate success-notification auto-dismiss check.
- Stock reconciled from 2,000 g and 20 containers to 1,700 g and 17 containers
  for three selling units. Receipt and payment updates did not deduct them again.
  The two paid/received fixture orders reconcile to RM36 food + RM4.50 delivery.

All contacts, stock, receipt images and payment references in these checks were
fictional fixtures. No actual bank QR image, credentials, customer data, production
DB writes, live SMTP messages or courier bookings are included. QR receipt images
were synthetic coloured images; no banking-app transfer or scan was performed.
PostgreSQL ran in an ephemeral container bound to loopback, using temporary
storage. Its connection settings were local to /tmp and are not committed.

These are developer functional checks, not participant research or client sign-off.
Vercel deployment Ready status and the owner's real bank/physical-stock setup were
not verified. The separate FYP revision map preserves the objectives and identifies
which narrative/diagrams need a later document revision without claiming it exists.
