# Orders daily summary and earlier-record review — 5 November 2026

Branch `main`, based on `f0fb77c`. Developer verification uses isolated fixtures;
source publication is not a claim of Vercel Ready or live database correction.

## Delivered

- Daily summary under Orders, with Malaysia date URL/browser-back behaviour.
  Sales retains financial reporting and its historical analytics remain lazy.
  Summary viewing avoids fetching the entire admin order list or forecasts.
- Accepted customer names in the queue/search, and exact ORD-reference searches.
  Review undated open orders without inventing dates or changing past handovers.
- Separate preview-first order slips preserve accepted name/address/phone,
  prices, totals, payment and receipt facts. No automatic print or bank action.
- Earlier payment records remain factual history; current owner/customer panels
  do not advertise funding using retired methods. Old manual-transfer instructions
  do not prompt another payment. Historical provider/reconciliation APIs remain;
  their removal or global retirement is not claimed.
- Sales excludes known test-only payment methods, including imported method rows
  without a receipt event. No stored payment/status/evidence is rewritten.
- Optional read-only preview and audited SQL correction for exact known sample
  batch-code patterns. No quantities, dates, costs, holds, stock allocations or
  database IDs change. Original references survive in zero-quantity audit logs.
  Supplier references and collisions are preserved; retries are no-ops.

## Verification

- Full Django `myapp`: **973 discovered; 924 passed, 49 skipped**, SQLite.
  The sandbox initially blocked the existing catalogue HTTP test; the full suite
  passed after local-test-server permission was granted. PostgreSQL-only tests
  are not represented as SQLite passes.
- Focused report/inventory SQLite tests: **24 passed**, covering staff-only
  access, read-only behaviour, query bounds, saved identity/prices, Malaysia
  midnight, aggregation/pagination, missing dates and known-test exclusion.
- Isolated PostgreSQL 16: **39 passed, no skips**, including the actual new SQL,
  preview/no writes, all preserved stock fields, zero-change traceability, repeat
  execution, case-insensitive conflicts, exact pattern scope and the prior
  pending-trigger/RLS-follow-up case. Existing stock-receipt tests also passed.
  Docker permission initially stopped the rehearsal; it was subsequently granted
  and the final script was verified. No production database was used.
- Frontend unit/SSR, UX suites, focused reports/helpers, changed-file ESLint and
  production build passed. Sandbox-only SSR runs reported background Vite socket
  warnings; the elevated focused report run and real browser checks validate the
  local-server behaviour separately. Existing >500kB chunk advisory remains.
- Built-app Chromium desktop/mobile walkthrough: dated quantities, counts and
  missing-date notice; URL date changes/browser back; no full order/forecast
  request for summary; saved-customer-name search; exact order targeting;
  owner/customer earlier payments without funding links; financial exclusions;
  explicit print action, print CSS, PDF and mobile layout. No uncaught errors or
  data-mutation requests were observed in the tested page interactions.

The browser fixtures are fictional: Local kitchen, Saved recipient, a local
street, test credentials and non-live orders/payment flags. They are developer
walkthroughs, not participant/client evaluation. Screenshots are ordinary
viewport captures. A local PDF was generated with Chromium; no printer, real
payment, email, courier or production record was used. The PDF is not included
as a real customer document. No model/forecast/training/evaluation changes.

## Owner application of inventory references

After reviewing `deploy/sql/preview_sample_batch_references.sql`, run the full
`deploy/sql/standardize_sample_batch_references.sql` in Supabase SQL Editor.
The private schema is explicitly `django_app`, matching the owner's earlier
schema confirmation. The correction includes `SET CONSTRAINTS ALL IMMEDIATE`;
no table/RLS/constraint is disabled or altered. Busy rows fail safely; conflicting
codes are returned in `needs_review`. Refresh inventory after a successful run.

No new migration or environment variables. The SQL is prepared and rehearsed,
not already applied to the live database. Missing historical dates and actual
payment evidence must be reconciled by the owner rather than fabricated.
