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
| 2 | Basket, addresses, checkout, delivery quotes, orders, demo wallet, receipts, refunds and PayPal: ownership, cross-account browser state, pricing, duplicate/concurrent mutations, query count and transaction duration | Pending |
| 3 | Menu management, recipes, inventory/FEFO, planner, manual schedules and availability: validation, permissions, scheduling bounds, locks and query growth | Pending |
| 4 | All FreshCast data modes, forecast/scenario APIs, Groq help and shopping tools: data privacy, untrusted input, resource limits, model loading and response cost | Pending |
| 5 | Images/external URLs, reviews, reports/CSV, reminders, recovery mail, backups/downloads and maintenance: injection, outbound access, export scope and large responses | Pending |
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
- Recovery email is currently synchronous with a bounded SMTP timeout. Queueing,
  delivery failure handling and timing-based account disclosure need dedicated
  inspection in batch 5. A generic response body alone does not eliminate timing
  differences. SMTP/production mail and PUBLIC_APP_URL must be verified privately.
- CSP must account for actual PayPal SDK, images and other sources. It is not
  enabled with a guessed policy in this batch; script/DOM review belongs to batch 6.

Next batch: checkout/order/payment ownership, financial integrity, concurrency and
database request cost. Reproduce delayed requests during logout/account switching
first: the order/wallet React providers retain state between refreshes, so the
frontend needs its own privacy check beyond HTTP cache protection. This behavior
was identified during source mapping but has not yet been verified in a browser.
