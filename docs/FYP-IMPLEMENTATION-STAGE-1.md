# Stage 1: reliable single-vendor preorders and measurable outcomes

Implemented 29–30 September 2026. This is a single-vendor application. No marketplace, multiple seller accounts, or tenant architecture was introduced.

## Delivered

### Preserve accepted orders

- New order items freeze ingredient quantities, ingredient names/units, preparation configuration and the packaging estimate at acceptance.
- Shopping planning and cooking use the frozen ingredients, not the editable menu recipe.
- Deleted menus do not remove accepted ingredient records or prevent cooking a recorded recipe.
- Planner's task preview keeps accepted preparation settings by default. The explicit **Amend this pending order** checkbox previews adoption of the current recipe and packaging estimate. Confirmation checks the signed preview against current availability and order version.
- Amendments store before/after records and actor/time. Orders expose **Accepted recipe and amendment history** to the owner.
- Cooking records each actual batch, consumed quantity, unit purchase cost and recorded expiry. Retrying cooking does not deduct again; shortages roll back both quantities and consumption records.
- Checkout accepts an idempotency reference so a retry can retrieve the original order. The frontend retains it across a failed request and changes it for a changed checkout/basket.

### Payment, accounts and inventory safeguards

- Orders now use **Payment records** instead of an editable payment-status dropdown.
- Record a verified full receipt or full refund with a reference, notes, actor and timestamp. Pending and failed refund attempts do not mark money returned; a pending attempt must be resolved before another starts.
- External bank/COD records are reconciliations of actions performed outside the app. They do not execute transfers. Completed demo-wallet refunds return demo credits atomically and once.
- Partial payments/refunds are deliberately outside this stage. Cancellation does not automatically refund an order.
- Customer management allows activation/deactivation only. It cannot create/delete users or change staff roles. Owner accounts are protected by the API, not just hidden UI controls.
- Deleting a user with orders is protected at the model layer.
- Signup validates password strength, bounds inputs and handles duplicate usernames. Login/signup/recovery enforce CSRF for browser requests.
- Shared-database attempt limits cover login, signup and recovery. These are basic application controls, not an exact concurrent/distributed rate limiter. Configure trusted proxy/edge controls for the deployment; REMOTE_ADDR may identify a shared proxy.
- Optional recovery email at signup and a **Forgot your password?** flow use one-hour, single-use Django tokens. The public origin is configured explicitly. Old accounts without a recovery email still require owner-assisted recovery.
- Batch quantity corrections require a reason and create an inventory log. Batches with consumption, waste or audit records cannot be removed via the inventory API. A batch cannot be reassigned to a different ingredient.

### Connected date-aware ordering

- The menu's **Find food for your date** form accepts date, portions, optional total food budget and category.
- Guests can request suggestions. Authenticated customers can receive preference scores from paid, non-cancelled purchase history. Provisional unpaid orders no longer count as purchases in the ranking.
- Up to three choices are offered, with feasible hourly delivery suggestions from the same scheduler used by checkout. The top 30 matching ranked menus are checked to bound work.
- Current ingredient stock no longer excludes a future menu suggestion: procurement can be required for a valid future preorder.
- Adding a suggestion carries its preferred delivery time to checkout. Login is still required to use the cart; guest checkout is a later feature.
- Checkout can suggest hourly times for the entire basket and explicitly rechecks availability when placing the order.
- The quote reports whether procurement is required. It does not expose private stock quantities to customers. This estimate allocates existing commitments first; the owner planner recalculates chronological allocations and shortages after acceptance.
- The planner flags orders with missing accepted recipes so an empty shopping list is not mistaken for complete coverage.

### Historical contribution and recommendation measurement

- Sales includes an **Order contribution and recommendation outcomes** panel and **Trace an ingredient batch to orders**.
- Food contribution uses discounted food revenue, actual batch costs recorded at consumption and the packaging estimate frozen at acceptance/amendment. Unknown costs remain unknown.
- Contribution is available for delivered paid orders and cooked cancellations/refunds with sufficient records. Cancelled/refunded food revenue is zero while consumed costs remain. Delivery income/cost, payment fees, labour and overhead are excluded: this is not net profit.
- Date range means order placement dates. The latest 200 orders are shown, with explicit cohort size and totals limited to shown rows.
- Recommendation records include context, version, ordered product IDs, rendered-result exposure, clicks, basket additions and server-linked orders. Paid outcomes derive from order payment status; the client cannot declare a purchase.
- Attribution requires a rendered recommendation, a matching ordered product, the same browser-session identity and a 24-hour window. Metrics count requests with rendered results, not unique people. Repeat searches can create multiple exposures. They are observational outcomes, not a claim of conversion lift.
- `RECOMMENDATION_EXPERIMENT=True` enables sticky browser-session assignment to popularity versus personalised ranking. Default is personalised ranking with observational metrics. This does not replace a properly designed user study, account for all repeat-user dependence, or prove statistical significance.

## Database rollout

Migrations **0015** and **0016** are required before running this code against an existing database. They were verified on isolated databases; the live Supabase database was not migrated during implementation.

1. Back up the target database and verify restoration into a separate database.
2. Stop writes or use a maintenance window so legacy baselines are captured consistently.
3. Run `python manage.py migrate` using the backend environment targeting the intended database.
4. Deploy the matching frontend/backend and inspect pending legacy orders in Orders/Planner.

Legacy behavior is intentionally explicit:

- Outstanding, unconsumed orders receive a **legacy baseline** copied from the recipe present at migration time. It is not claimed to be their original accepted recipe.
- Historical consumed orders remain **legacy unknown**. No ingredient consumption or historical packaging cost is invented.
- Prior paid/refunded statuses become **legacy unverified** opening payment records. Their actual transfer dates/evidence are unknown; migration time is only the record creation time.
- A later explicit pending-order recipe amendment can record a current packaging estimate. It does not recover a historical cost.

Do not reverse schema migrations to undo ordinary order changes. Use the preserved records and a reviewed correction process. Code/database rollback should use the verified deployment backup.

## Recovery email setup

Set `PUBLIC_APP_URL` to the real frontend origin, without a trailing path. Configure a working SMTP backend and sender using the existing email settings. Recovery responses are intentionally generic and do not reveal whether a username/email pair exists. The development console mail backend does not deliver email.

SMTP delivery, provider configuration, sender authentication and real recovery delivery still need a staging check. No real recovery emails or other external messages were sent during this work.

## Verification

- Backend: **112 tests discovered; 111 passed, 1 skipped** on isolated SQLite. The skipped test requires isolated PostgreSQL row locking.
- Includes legacy migration verification, immutable accepted recipes, explicit amendment history and stale preview rejection, stock rollback, preserved batch costs, refund retry protection, account permissions, signup validation, login CSRF, recovery token reuse rejection, future-date suggestions and recommendation attribution.
- Frontend: all **10 existing utility tests passed**. These are not component or browser tests.
- Targeted ESLint checks passed for the seven new UI components/pages. This is not a claim that the repository's entire existing lint baseline is clean.
- Final production frontend build passed after the implementation edits.
- `makemigrations --check --dry-run` reported no missing migrations.
- `git diff --check` passed.
- Browser: the public menu and guide rendered with synthetic data in an isolated local database. Automated clicks did not reliably activate controls, so the interactive browser journey is **unverified**, not passed.
- Production data was not inspected or modified. No deployment or real payment integration was activated.

Use the existing safe SQLite commands in `docs/TESTING.md`. For the PostgreSQL-only test, configure a separate disposable PostgreSQL database with permission to create its test database, disable dotenv, and run `python manage.py test myapp.test_postgres_commitments --noinput`. Never point this exercise at production credentials.

## Manual acceptance sequence

1. On Menu, request a date, portions and budget. Confirm the result fits the food budget and offers only feasible suggested times.
2. Add a choice, sign in if needed, and verify the preferred time is carried to checkout. Suggest whole-basket times, check availability, and place the preorder.
3. Edit the menu recipe. In Orders, confirm the accepted recipe remains unchanged. In Planner, preview and explicitly approve an amendment only when intended.
4. Review shopping shortages. Receive the required batches with purchase costs; record any waste separately.
5. Move the order through processing/cooked. Confirm batch quantities and trace records; retry and confirm no second deduction.
6. Record a verified payment reference, deliver the order, and inspect its food contribution. Change current ingredient costs and confirm recorded consumption costs do not change.
7. Record a pending refund, resolve it as failed, then record a completed external refund (or a demo-wallet refund). Confirm the status, audit trail and contribution result.
8. Check recovery with a test mailbox in staging and confirm the same reset token cannot be reused.

For FYP evaluation, compare timed ordinary-browsing and guided-choice tasks using counterbalanced task order. Record completion, time, decision effort and errors. Use live randomized conversion analysis only with adequate traffic and an agreed analysis plan; do not claim increased conversion from the existence of a metric panel.

## Deferred to later batches

Update: customer rescheduling was subsequently implemented in [Stage 2](FYP-IMPLEMENTATION-STAGE-2.md). The list below records the original Stage 1 handoff.

Photo uploads and onboarding wizard; guest checkout; pickup and delivery zones; customer rescheduling; payment deadlines; supplier directory and purchase orders; recurring plans; waitlists; additional staffing/equipment; full-site translation; campaigns; richer menu-level profitability and direct-cost allocation; automated real payment integrations; monitoring/backup infrastructure and a completed cross-device browser acceptance run.

Multi-vendor conversion is excluded from this project's direction. The next batch should remain within the single-vendor FYP objectives.
