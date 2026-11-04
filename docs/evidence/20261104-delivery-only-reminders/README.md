# Delivery-only kitchen reminders — 4 November 2026

Branch: `main`, based on `0c3da50`. This records source/local verification, not
Vercel Ready, live scheduler activity, SMTP acceptance or an inbox delivery.

## Behaviour

- Simple kitchen mode suppresses preparation mail, including historical orders
  with old saved preparation fields. Historical scheduled kitchens retain prep
  reminders for scheduled orders, without using simple-order preparation fields.
- One shared owner queue drives sending, staff queue counts and command preview.
  Open delivery/collection events are eligible within 24 hours before/after their
  time. Received/cancelled, undated, older overdue and more distant orders are
  excluded. Actual receipt, payment and inventory are never changed by a timer.
- Simple-order receipts identify the agreed time. Repeated checks do not replay
  success; a changed time can get a new reminder. Old successful `delivery_at`
  receipts suppress upgrade replay until a later audited time amendment. Existing
  receipt/history rows are preserved. Collection messages are labelled correctly.
- Lock/recheck and the shared three-email attempt budget remain. Failed mail has
  no success receipt and retries on a later call. SMTP acceptance before a crash
  and database commit can still cause a duplicate; no exactly-once claim is made.
- Settings shows owner delivery/collection queue counts and phone coordination.
  Current name/phone/passkey customers have no email subscription. Older explicit
  email subscriptions remain in collapsed history with their previous consent
  rules. No automatic SMS/WhatsApp is claimed or added.
- No new scheduler, credential, table or migration. Repository inspection found
  one five-minute GitHub schedule and no Vercel cron entry. Live GitHub API
  history was unavailable through this environment's restricted API access. No
  production worker, external scheduler, actual email or database was changed.

## Checks

- Full Django `myapp` SQLite suite: 966 discovered, **922 passed, 44 skipped**.
  Legacy preview coverage was made explicitly scheduled-mode; an absent kitchen
  uses the current simple default and must not emit preparation emails.
- Focused SQLite reminder/security suites: 51 discovered, 49 passed, 2 skipped.
- Isolated PostgreSQL 16: **78 passed, no skips**, covering new owner rules,
  actual overlapping-worker locking, existing customer consent/dispatch/time
  updates, arrival ranges, bearer authentication, private worker activity,
  bounded history reads and already-notified history query limits.
- Scheduler runner: **8 passed**, with HTTP and credentials mocked. Covers local
  config-only checks, bearer use, bounded response/count validation, sanitized
  failures and refusing credential redirects. No live endpoint call was made.
- Frontend unit/SSR and UX suites, targeted ESLint, production build passed.
  New monitor checks cover both modes, owner counts, invalid/partial metadata,
  current phone-account copy and preserved collapsed earlier subscriptions.
- Chromium desktop/mobile against a built app and isolated fixture database:
  staff queue readback (one delivery, zero preparation despite saved prep time),
  refresh without sending, collapsed earlier email queues, responsive layout and
  accurate 24-hour rules. No uncaught errors or worker/test-send requests.

All email addresses, customers and orders used for tests/screenshots are local
fixtures. Screenshots are ordinary browser viewport captures; the local fixture
has no external scheduler secret, so its setup warning is expected. They do not
show the live kitchen's settings. Mail was mocked, never sent. PostgreSQL was a
short-lived local container with no production credentials/data.

The existing build advisory for a chunk above 500kB remains. No model, forecast,
training or evaluation changes. Frozen integration/report branches and FYP
objectives/DOCX are untouched. The Orders daily-summary entry and reviewed
historical record handling remain the next follow-up batch.
