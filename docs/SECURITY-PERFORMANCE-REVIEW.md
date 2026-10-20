# Security and performance review

Review started 20 October 2026 (Malaysia/Singapore). Repository:
`CHplus2/preorder-freshness`. Changes are developed on
`integration/dormathon-demo` and published to both that branch and `main`, as
requested. This is a staged review, not a certification that every component or
the deployed service has been audited.

## Batch coverage

| Batch | Components and questions | Status |
| --- | --- | --- |
| 1 | Browser/admin login, signup, password recovery, session/CSRF boundaries, sampled owner permissions, private response caching, runtime defaults and authentication housekeeping | Completed; deployment limitations below remain |
| 2 | Basket, addresses, checkout, delivery quotes, orders, demo wallet, receipts, refunds and PayPal: ownership, cross-account browser state, pricing, duplicate/concurrent mutations, query count and transaction duration | Completed locally; live-provider and scale checks remain |
| 3 | Menu management, recipes, inventory/FEFO, planner, manual schedules and availability: validation, permissions, scheduling bounds, locks and query growth | Completed locally; scale and operational limits below remain |
| 4 | All FreshCast data modes, forecast/scenario APIs, Groq help and shopping tools: data privacy, untrusted input, resource limits, model loading and response cost | Completed locally; live-model/provider and load limits below remain |
| 5 | Images/external URLs, reviews, reports/CSV, reminders, recovery mail, backups/downloads and maintenance: injection, outbound access, export scope and large responses | Completed locally; live-mail and scale limits below remain |
| 6 | Customer/admin React routes, mobile interaction, browser storage, DOM/XSS, third-party scripts, dependencies/CI, Git history and deployment: bundles, images, caching, accessibility and measured page performance | Pending |

Each batch investigates concrete findings, fixes reproducible defects where
possible, runs relevant regressions and records what remains unverified. Sampled
permission checks here do not replace per-resource ownership and mutation review
in later batches.

## Batch 1 findings and changes

| Finding | Impact and evidence | Resolution |
| --- | --- | --- |
| High: an alternative password authentication path bypassed login controls | DRF's implicit BasicAuthentication accepted a valid Basic header on a protected account PATCH with no session/CSRF token. The regression returned 200 before the fix. Other endpoints could also check passwords outside the limited login view. This was reproduced only on an isolated test database. | Configure session authentication explicitly. Customers sign in through the existing rate-limited, CSRF-protected login. Basic headers no longer authenticate browser APIs. Explicit webhook/cron authentication and deployment bearer export remain separate. |
| High: Django admin login did not share application login limits | `/django-admin/login/` used Django's independent form, outside `auth_limits.limit`. Rate-limiting only `/api/login/` left this password-checking path open. | Wrap the staff login with the same account/IP attempt limits. Preserve Django's staff checks, CSRF, form, redirect behavior and non-cacheable response. Throttled submissions return 429 and Retry-After. |
| Medium: private responses lacked an explicit no-store policy | Account/order/address/wallet/auth responses and some permission denials had no explicit Cache-Control. No actual shared-cache disclosure was demonstrated; this is a privacy safeguard against retention or future caching changes. | Add private API response middleware. Authenticated API responses, sensitive route families and authorization-header responses receive no-store unless already protected. Existing no-store policies are retained. Anonymous public catalogue and static asset caching are not forced off. |
| Medium: public Vercel runtime could inherit development settings | DEBUG honored the environment flag on Vercel, and default host/origin lists included local development entries. These are source-level configuration risks; the actual production values were not inspected. | Vercel always disables DEBUG. Its defaults use deployment hostnames and corresponding HTTPS CSRF origins, with no default cross-origin allowance. Local Vite development retains localhost defaults. Explicit environment allowlists are still honored. |
| Low/performance: every authentication attempt ran a cleanup DELETE | `limit()` deleted all attempt records older than a day on each invocation, even when there was nothing to remove. | Amortize housekeeping to once per five minutes per cache instance. Attempt counters remain in the shared database. Cache expiry/restart does not reset login limits; the 15-minute query window still ignores old attempts. Warm-request SQL verification finds no cleanup DELETE. No production latency claim is made. |

No schema migration is needed. No production customer records, payments,
inventory, model artifacts or environment secret values are modified by this
batch. Browser login, checkout and PayPal continue to use session cookies.

## Checks and observations

- Regressions cover a valid Basic-header account mutation, real session
  login/logout, missing CSRF, attempted self-promotion, shared admin login limits,
  12 sampled admin routes for anonymous and ordinary customers, private cache
  headers, public catalogue access, cleanup amortization and Vercel defaults.
- Existing tests cover recovery's generic response and single-use reset token,
  authentication limits, cross-customer addresses, payment ownership and explicit
  bearer-only bundle transfer. Those passed with the changed authentication
  policy; later batches will inspect their deeper transaction behavior.
- Full Django suite: 479 tests run, four skipped. PostgreSQL-specific concurrency
  checks were not exercised by the isolated SQLite run.
- Frontend utility, PayPal and conversational-ordering tests and production build
  passed. The existing main-bundle size warning remains for batch 6; build success
  is not proof of good Core Web Vitals.
- No pending model/schema migration was introduced. Optional CatBoost/data loading
  is already deferred until after prediction permission checks; it was not
  retrained or moved by this review.
- A narrow pattern scan examined 661 tracked text files under 1 MB in the initial
  working snapshot. Matches were limited to examples/test fixtures. No matched
  credential values were printed. This does not cover all secret formats, ignored
  files, binaries, Git history, GitHub configuration or Vercel secrets.

## Batch 2 findings and changes

| Finding | Impact and evidence | Resolution |
| --- | --- | --- |
| High: browser state survived account changes | Chromium reproduced an earlier customer's order appearing after a different customer signed in and their order request failed. Persistent provider state and delayed responses could retain old orders, cart or wallet details. | Give each authenticated identity/role a session scope; remount private providers/pages at scope changes and ignore responses captured by an older scope. Recheck on focus and notify other tabs after login/logout. Clear private checkout/address selections on account changes while retaining same-account retry references. The auth response now includes the signed-in user's own ID. |
| High: demo-credit writes could lose updates or leave an incomplete ledger | Top-up previously read and saved an unlocked balance without an atomic ledger entry. Concurrent checkout/top-ups could overwrite balances; a ledger-write failure left a credit without its transaction. These are fictional credits, not real money. | Serialize creation/top-ups with the same user/wallet locks used by checkout. Credit and ledger insertion commit atomically. PostgreSQL tests cover simultaneous distinct and duplicate top-ups, and a top-up concurrent with checkout. |
| Medium: retrying a top-up could credit twice | A successful server operation with a lost browser response could be repeated as a new credit. | The browser persists a per-account UUID and reuses it after an ambiguous failure/reload. The server recognizes the reference under the wallet lock, credits once, returns the current balance, and refuses changed amounts for that reference. Legacy requests without a UUID remain compatible but do not provide this retry guarantee. |
| Medium: malformed or excessive demo-credit inputs failed unexpectedly | Non-numeric/non-finite amounts and balances outside field capacity reached arithmetic/database failures. A refund near the balance ceiling had the same overflow risk. | Validate positive cent amounts and reference format; enforce a shared balance ceiling for credits and completed wallet refunds. A rejected refund preserves paid status and creates no ledger/payment event. Add a 30/minute per-user credit-mutation throttle; its cache limitations are listed below. |
| Medium: cart responses disclosed internal packaging costs | The cart's nested product serializer lacked request context, bypassing its existing staff-only cost-field filtering. List, add and update responses exposed `packaging_cost`. | Pass request context for all three cart responses. Regressions verify customer responses omit the field and customers cannot mutate another customer's cart rows. |
| Performance: read requests acquired mutation locks | Fetching an address locked its customer row; reading owner payment records locked the order. These reads could block unrelated writes while the transaction completed. | Acquire these row locks only for mutations. Transaction wrappers remain; this does not claim all transaction overhead has been removed. |

Additional checkout checks reject a foreign address or reused foreign checkout
reference without clearing the basket. Client-supplied totals, shipping,
discounts, user IDs and paid claims cannot override server pricing. A two-portion
fixture at RM12 each, 10% bulk discount and RM5 delivery remains RM26.60 and unpaid.
Existing PayPal permission, amount/currency verification, capture recovery,
receipt/refund and checkout retry tests continue to pass. No real provider capture
or production database operation was performed.

### Batch 2 verification

- Full isolated Django suite: 496 tests run, seven skipped. PostgreSQL-specific
  locking tests are skipped in this SQLite run.
- Separate temporary PostgreSQL 16 database: 19 financial/privacy/concurrency
  tests passed, including the five PostgreSQL commitment/wallet concurrency tests.
  Concurrent buyers reserve the last menu portion only once; the second order
  remains an unpaid, unreserved review request, consistent with current checkout
  behavior. The older test expecting rejection was corrected to verify this rule.
- Frontend utility, checkout, PayPal, conversational-ordering and UX tests,
  production build, and ESLint on changed frontend files passed. The main bundle
  remains about 571 kB minified; reducing route/bundle cost belongs to batch 6.
- Chromium exercised actual local Django sessions and APIs: account switching,
  a delayed old-account response, wallet isolation, a lost top-up response,
  same-account reload, and an idempotent retry. The earlier account's order no
  longer appeared; a single 10-credit top-up changed the new account from five to
  15 credits exactly once. Mobile rendering at 390px had no overflow/page errors.
  Only fictional local records were changed.
- The customer order-history query count stayed constant between one and 20
  orders (at most three queries in the regression). The response still includes
  all matching orders: payload size and rendering grow with history. Pagination
  needs a coordinated API/UI change rather than silently truncating records.
- No model/schema change is required. Source changes do not establish that a
  Vercel deployment has completed or that its live provider configuration works.

### Wallet retry contract

`POST /api/wallet/topup/` accepts a positive, cent-precision `amount` and an
optional UUID `request_id`. New frontend requests always supply the UUID. A
successful response includes numeric `balance` and boolean `already_applied`;
replaying the same UUID/amount returns the current balance without a new credit.
Changing the amount for that UUID returns 400. Wallet creation returns 201 for a
new wallet and 200 for the customer's existing wallet. The cent-based maximum
balance is 99,999,999.99 fictional credits. These APIs never transfer real money.

## Batch 3 findings and changes

| Finding | Impact and evidence | Resolution |
| --- | --- | --- |
| Medium/integrity: preparation limits were validated against a stale menu | A partial update could pass validation, then save an early-finish allowance after another editor shortened the preparation span. The regression reproduced a two-day allowance being saved against a newly committed one-day span. | Revalidate the coupled span/early-finish limits after acquiring the current product row lock, before saving either menu or recipe changes. Invalid stale edits return a validation error and do not overwrite the concurrent change. |
| Medium/reliability: extreme storage durations caused server errors | Large positive shelf-life, opening and thawing durations reached date arithmetic and returned 500 for otherwise structured staff requests. Four variants reproduced this behavior. | Return 400 with a storage-duration message when calculated dates exceed Python's supported range. Existing expiry/receipt, source guidance and quarantine rules remain enforced; no dates are silently shortened. |
| Integrity/concurrency: batch deletion checked history without a stock lock | Unlike edits, cooking and wastage, DELETE did not lock the batch while checking its traceability records. Checks could race with new adjustments/audit entries. No production traceability loss was observed. | Lock the batch inside an atomic deletion before checking waste, logs and consumption. A PostgreSQL regression holds a concurrent adjustment uncommitted, then verifies deletion waits, sees the committed audit entry, refuses deletion and retains the 90g batch/log link. |
| Reliability/performance: cooking loaded stock separately for every item | Each ordered menu acquired its own stock locks. Opposite menu sequences could request ingredient locks in opposite orders; repeated ingredients also caused repeated stock queries. The four-menu regression observed four stock reads before the fix. A production deadlock was not observed. | Prefetch all accepted ingredients and acquire usable stock once for the whole order, ordered by material, expiry, receipt and ID. Deduct from the shared locked rows with per-item consumption/cost/audit records. PostgreSQL checks verify two opposite-order cooks cannot overdraw limited stock: one succeeds and the other rolls back with a shortage. |
| Performance: read-only planning screens locked the single kitchen | Delivery-change eligibility/history and manual-plan history used the store-wide scheduling lock and an order write lock despite making no change. A source-level regression fails if these GETs attempt that lock. | Take store/order locks only on mutations. Keep signed confirmation, permission checks, stale-preview checks and mutation lock order intact. Transaction wrappers remain; no production latency claim is made. |

### Batch 3 verification and business rules

- Full isolated SQLite suite: 506 tests run, ten skipped. Separate TLS-enabled
  PostgreSQL 16 run: 21 targeted tests passed, including all eight PostgreSQL
  checkout/wallet/stock concurrency checks. These are local fixtures, not the
  production Supabase database.
- Before the fixes, the new operations regressions failed on stale menu limits,
  four overflowing date cases, read locks and repeated stock reads. Afterward,
  the focused 116-test operations/planning/recipe/freshness suite passed.
- FEFO checks verify the accepted 100g recipe survives a live-menu edit to 500g,
  consumes 60g from the near-expiry lot and 40g from the later lot, excludes
  expired/quarantined/future-received stock, and records no second deduction on
  a repeated cooked status. A shortage in a later item rolls back every earlier
  item, audit entry and status change. A concurrent stale stock edit cannot
  restore consumed quantities.
- Operational GETs/writes require staff where appropriate; customers cannot
  mutate menus or another customer's delivery arrangement. Staff session writes
  still require CSRF. Existing signed-preview, stale-plan, capacity, equipment,
  kitchen closure, order notice and multi-day preparation regressions passed.
- Existing query checks cover inventory lists (one query at one and 30 batches)
  and planner query growth across one and 13 orders. Cooking now performs one
  usable-stock SELECT for the four-menu repeated-ingredient fixture. Audit writes
  still scale with actual allocations; these checks do not measure live latency
  or large-database throughput.
- Frontend utility, planner, checkout, PayPal, shopping and all three FreshCast
  data-mode tests passed, as did the production build. No frontend files or ML
  models changed. No schema migration is required. The existing bundle-size
  warning remains for batch 6.

The automatic planner remains a bounded, conservative search, not a globally
optimal scheduler. It can reject a basket that an owner could arrange differently.
Multi-day work still needs configured spans, waiting/holding limits, suitable
resources and explicitly resumable steps; cooking is not silently split. Manual
owner arrangements can accept disclosed conflicts or out-of-hours work after
preview. Those overrides require human review and do not establish food safety.

Planner stock allocation is advisory and uses preparation dates conservatively;
it does not reserve or deduct physical batches. Cooking records consume stock
usable on the day the owner records completion. These serve different purposes;
a future shopping projection is not proof that stock is available when cooking
actually happens.

## Batch 4 findings and changes

| Finding | Impact and evidence | Resolution |
| --- | --- | --- |
| Medium/privacy: saved kitchen decisions were not cleared at account changes | Signed slips contain internal forecast, batch and cost evidence. The browser's review key was separate from checkout cleanup, and asynchronous save/import callbacks could write it after their account session ended. | Clear saved reviews/notes on logout or account changes; keep them across same-account reloads. Guard save/import results against the current session scope before writing storage. Explain that users must download slips to retain them after signing out. The browser regression uses actual local signed-review APIs and a delayed response. |
| Reliability/resource cost: malformed Genpact requests could reach model loading first | Forecast/backtest validation ran after bundle loading. Oversized digit strings could also reach Python's integer-conversion limit. The new regression detected bundle access for invalid parameters before the fix. | Reject unknown fields, invalid types, zero/negative IDs and digit strings over ten characters before bundle loading. Bound IDs/week indices to positive signed 32-bit integers; preserve bundle-based membership/week checks. Reject unexpected metrics/centers query parameters. No forecast formula, trained artifact or source label changes. |
| Reliability: malformed shopping-confirmation bodies acquired locks before validation | Array/string/null bodies reached customer/kitchen locking and then object access, instead of a structured 400. The boundary regression failed before the fix. | Require an object before acquiring mutation locks. Valid cart previews/confirmations retain existing actor binding, signatures, current-price checks and idempotent additions; this does not place or pay for an order. |
| Credential handling: AI requests used the default redirect handler | Python's default HTTP redirect handling can copy request headers to another URL. Groq's endpoint is fixed server-side; no actual credential leak or provider redirect was observed. | A shared provider opener refuses redirects, preserving normal proxy and TLS verification. Both assistants retain their five-second timeout, bounded response read and guided fallback when the transport fails. Mocked redirect failures verify neither assistant treats a redirect as an answer. No live Groq call was made. |
| Performance: daily kitchen decisions prefetched irrelevant order history | The per-menu forecasting layer loaded every order/item before applying its 112-day history and requested future window in Python. | Apply the same delivery-date/fallback date window in SQL before prefetching items. A boundary regression checks the first/last included dates, excluded older/future dates and fallback orders, and compares the complete decision output with the former all-orders snapshot. Forecast math and synthetic-data labels are unchanged. |

### Batch 4 verification and source boundaries

- Full isolated Django suite: 512 tests run, ten skipped. The skipped checks need
  PostgreSQL or a provisioned real Genpact artifact; their status is not converted
  into a live-model success claim. A focused 85-test forecast/decision/scenario/
  help/shopping run passed with two artifact-dependent skips; the final security
  and shopping checks passed 30 tests after the added malformed-body regression.
- All predictive route families deny anonymous/customer access before loading
  the model or calculating private kitchen plans. Existing staff session/CSRF,
  no-store, signed-review tampering, scenario read-only and no-write tests passed.
  The browser's downloaded slips remain private files outside logout cleanup;
  staff can explicitly restore a signed slip after server verification.
- Actual local Django sessions and APIs exercised saving a signed decision,
  same-account reload, logout, customer login and fulfillment of a delayed old
  review response. The review was retained on reload, removed at logout and not
  recreated by the stale response. The 390px view had no overflow/page errors.
  Only fictional local fixtures were used.
- Frontend utilities, predictive adapters/calculations and source-labelled
  rendering, planner, checkout, PayPal, shopping and UX checks passed. Changed
  frontend files passed ESLint, and the production build passed. The existing
  approximately 571 kB main-bundle warning remains for batch 6.
- Genpact remains the optional saved CatBoost model with simulated operational
  inputs. Kitchen decisions remain based on kitchen records and existing daily
  baselines. Frontend sample mode is an explicit fixed example and does not
  replace an API failure. Existing tests reject mismatched source metadata,
  malformed/nonfinite responses and silent fixture fallback.
- Help sends only the opted-in, best-effort-redacted question to its fixed
  provider endpoint; shopping extraction sends only the opted-in request and
  fixed prompt. Neither sends database order/customer/stock records. Provider
  output is validated as a topic or draft fields, never rendered as arbitrary
  HTML/prose or executed as a payment/tool command. Current catalogue prices and
  server-signed, user-confirmed basket additions remain authoritative.
- No migration, model training/retraining, external payment, production database
  mutation or actual model-accuracy evaluation was performed in this batch.

## Batch 5 findings and changes

| Finding | Impact and evidence | Resolution |
| --- | --- | --- |
| Medium/resource cost: the browser checked archive size after reading everything | `arrayBuffer()` consumed the whole download before the 40 MiB check. A bad/oversized response could allocate beyond the intended limit. | Check declared length before reading, stream with a running 40 MiB limit, cancel overflow/failure, and verify SHA-256 before saving. Add a 30-second abort deadline and cancel downloads on component/account teardown. A stale response cannot trigger a new file after logout. This bounds retained response data, not every browser/network allocation. |
| Medium/privacy: recovery could print reset credentials to console logs | With a configured public app URL but the default console mail backend, a matching recovery request wrote its reset link into logs. Non-SMTP exceptions could also change the otherwise generic response only for a matching account. | Never send reset links through the console backend. Require a validated HTTPS app origin (HTTP loopback only for local development), without credentials, query or fragment. Mail failures retain the generic public response and emit only a fixed diagnostic without address, token or backend exception. SMTP delivery and timing privacy are not established by this change. |
| Reliability: malformed recovery bodies and non-ASCII cron credentials caused server errors | Recovery accessed object fields before validating body shape; string comparison of non-ASCII authorization headers raised an exception. New regressions failed before the fix. | Validate recovery/reset bodies with DRF serializers; compare cron credentials as encoded bytes. Invalid bodies return 400, incorrect cron credentials return 401, and no secret value is included in responses. Existing CSRF, token expiry and reset single-use checks remain. |
| Performance: public reviews downloaded every matching review | GET/POST responses serialized an unbounded review list. Large product histories grew response and browser cost without a way to request a page. | Return at most 20 reviews in descending ID order, preserving the array response. Add a validated `before` cursor and next-page header. The UI loads older reviews on demand with loading/error/retry handling; posting refreshes the first page. No older reviews are deleted or hidden from paging. Read-only GETs no longer open a write transaction. |
| Performance: reminder runs revisited already-notified history | The worker iterated due order IDs and queried their sent markers individually, even when both messages had already been sent. The 80-order regression showed query growth before the fix. | Filter unsent candidates with `Exists` subqueries, retain under-lock rechecks, and fetch at most the requested number of candidate orders. The regression sends the remaining notification with at most 12 queries. Actual attempts remain bounded by `limit`; skipped/locked candidates can wait for a later scheduler run. |
| Performance/reliability: private backup manifest generation reloaded the export | The command parsed the complete compressed JSON fixture and read the complete compressed file again for hashing. This added avoidable full-file allocations after export. | Count the same included base-manager records inside the backup transaction and hash the file incrementally. Restore tests verify manifest totals/model counts against actual exported JSON, IDs, relations and provenance. This removes the extra full-export reads, not all memory use in Django/its database driver. |
| Reliability: malformed configured archive checksums raised exceptions | A non-ASCII or missing checksum configuration reached string comparison after opening the archive. | Validate the fixed SHA-256 format first and return sanitized 503/no-store when invalid. The caller still cannot choose the archive filename or download kitchen records through this route. |

### Batch 5 checks and API details

- Final isolated Django suite: 520 tests run, ten skipped. Release/provisioning
  checks: 23 passed, including archive traversal, checksum failure, no overwrite,
  authenticated redirects and retained bundle handling. No migration is required.
- Frontend utilities, predictive, planner, checkout, PayPal, shopping and UX tests,
  changed-file ESLint and production build passed. The main bundle is about
  572 kB minified; the existing size warning remains for batch 6. Some parallel
  Vite SSR tests report development HMR-port contention while their assertions
  pass; isolating test-server ports belongs to the CI/browser review.
- Chromium exercised real local public review APIs: 20-item first page, failed
  next-page request, retry, all 25 older reviews, posting the eligible customer's
  new review, and paging all 26 records. HTML-like comment text stayed text and
  created no image/event handler. The 390px view had no overflow/page errors.
- An actual staff download from a local fictional archive matched the configured
  checksum. Logout during a delayed second response prevented another download.
  Separate stream tests reject an oversized declared length before consumption,
  cancel an oversized unknown-length stream, and cover cancellation/timeout.
  This is not a real Genpact recovery or deployed-download claim.
- Recovery tests use mocked/local mail only and verify generic failure responses,
  no sensitive diagnostic text, rejected unsafe origins, console suppression and
  invalid-body handling. No customer/owner email or notification was sent.
- CSV exports retain staff access, private/no-store headers, date/cohort bounds,
  formula escaping and missing-cost semantics. Tests cover formula-like menu
  names, embedded CSV quotes/newlines, exports beyond the dashboard's 200 rows,
  rejection above 5,000 orders and absence of customer contact fields. Calendar
  export uses generated order/step labels and UTC timestamps rather than copying
  free-text menu/comments into ICS fields; no arbitrary calendar text was added.
- Photos remain browser-loaded URLs, not a backend upload/proxy service. New
  stored links use existing URL/email validation; external links use noreferrer.
  Review/comment text is rendered through React text nodes. No new server-side
  image fetching, arbitrary file paths or customer-data download route was added.
- Private kitchen backup retains its outside-repository path rule, restrictive
  file modes, exclusion of sessions and environment values, read-only PostgreSQL
  snapshot and no-overwrite behavior. It includes private records/password hashes
  for restoration and must not be published. Windows ACLs and a full Supabase
  project backup require separate operator handling.

`GET /api/products/<id>/reviews/` returns at most 20 rows and optionally the
`X-Next-Review-Before` header. Pass that positive review ID as `?before=<id>` for
the next page. Unknown, repeated or invalid cursor parameters return 400. POST
still creates one eligible customer's review and returns the current first-page
array/header. Older clients retain the array shape but need the cursor to access
older pages.

## Remaining deployment and operational checks

These remain open; local tests do not establish a secure live deployment.

- Inspect HTTPS redirects and HSTS on the actual production/custom domains.
  Django's local `check --deploy` reports missing application-level HSTS and SSL
  redirect. A trusted edge can supply redirects, but that behavior was not verified
  here. Do not enable long-lived HSTS for unverified hosts/subdomains blindly.
- The same local check reports the intentionally short test SECRET_KEY and local
  HTTP cookie settings. Those are test-environment observations, not evidence of
  production credentials being weak. The Vercel configuration regression verifies
  DEBUG off and secure session/CSRF cookies on; actual deployment headers and key
  strength still require deployment verification without revealing the key.
- Review explicitly configured ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS and
  CORS_ALLOWED_ORIGINS for obsolete/wildcard entries. Custom production domains
  need their correct allowlists; this batch does not overwrite environment values.
- Auth account/IP attempts use shared database records, but count-then-insert is
  not a strict concurrent reservation. Edge limits should complement it. Confirm
  the real proxy client-IP behavior before trusting forwarded headers; arbitrary
  X-Forwarded-For input must not be adopted as authoritative.
- Groq, help and payment throttles use Django's configured cache; the current
  default is process-local. Global multi-worker quotas and burst controls need a
  shared cache/edge policy. The new housekeeping cache only controls cleanup,
  not the durable authentication attempt counts.
- The new demo-credit throttle shares that process-local limitation. It is a
  best-effort abuse control, not a global accounting quota. Database locks and
  reference checks, rather than the throttle, protect credit integrity.
- PayPal provider calls can hold order locks during bounded network waits.
  Removing those locks without a durable operation/state-machine design would
  weaken duplicate-payment protection. Live Sandbox latency, timeout behavior,
  webhook configuration and multi-instance deployment behavior remain unverified
  here; no live PayPal network request was made in batch 2.
- PostgreSQL checks used an isolated, TLS-enabled local server. They do not verify
  production Supabase pooler configuration or the whole suite on PostgreSQL.
- The current default CI test database is SQLite, so PostgreSQL-only tests skip
  there. Real locking checks require the isolated PostgreSQL test command; adding
  a dedicated PostgreSQL CI target remains part of the deployment/CI review.
- Inventory and operational planner lists still load all matching records.
  Constant query count does not bound payload size or in-memory allocation work.
  Larger deployments need API/UI pagination or explicit date windows and measured
  load tests, while preserving full relevant booking/stock inputs for scheduling.
- The daily-decision order window now bounds fetched history by date, not by
  record count. Very busy kitchens still need query-plan/index inspection and
  measured load tests. Aggregate weekly kitchen reporting and confirmed-order
  coverage still scan broader history; this batch does not silently truncate it.
- Model bundle loading is cached per process, not globally. Cold-start memory,
  concurrent cold loads, repeated staff forecast/replay requests and native model
  resource use still need deployment-scale measurement and quota policy. The
  two-thread prediction setting is not a complete concurrency/cost limit.
- No real Genpact artifact or live Groq request was exercised in batch 4.
  Redirect rejection and fallback were verified locally, not against the current
  provider/deployment. AI consent and best-effort redaction do not establish that
  all possible personal details can be detected automatically.
- Recovery email remains synchronous with a bounded SMTP timeout. Error-body
  consistency and console suppression do not eliminate timing-based account
  disclosure. Queueing and live SMTP/provider delivery require separate work;
  SMTP and the validated HTTPS PUBLIC_APP_URL must be verified privately.
- Reminder deduplication remains per order/event, as documented in the feature
  guide. Rescheduling after notification does not reset that marker. SMTP calls
  hold the order lock; provider acceptance followed by a database failure can
  still duplicate mail on retry. Timestamp-aware outbox/provider idempotency work
  is a separate workflow change, not an exactly-once claim for this worker.
- The CSV ceiling bounds orders rather than all line/consumption records or final
  bytes. Large real cohorts and full private database backups still need measured
  throughput/memory checks. No production-sized backup or live restore was run.
- CSP must account for actual PayPal SDK, images and other sources. It is not
  enabled with a guessed policy in this batch; script/DOM review belongs to batch 6.

Next batch: customer/admin browser routes, dependencies/CI, Git history and
deployment headers, including bundles, images, caching, accessibility and measured
page performance.
