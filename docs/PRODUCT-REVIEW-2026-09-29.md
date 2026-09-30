# Dapur Kita: FYP and startup product review

Reviewed 29 September 2026. Scope: repository code, documentation, existing automated tests and frontend build. No production database inspection, live payment/email validation, browser usability study, or seller interviews were performed. Business opportunities below are hypotheses to validate, not demonstrated market demand. This review does not change application behavior.

## Assessment

All five objectives have identifiable implementations. Scheduling and ingredient date handling are already substantially deeper than a basic CRUD project. However, implementing a recommendation list does not establish reduced decision fatigue or improved conversion; implementing a dashboard does not establish better business decisions. Those outcomes need evaluation.

The strongest next direction is a connected order-to-production system: choose a date, accept feasible work, identify ingredient shortfalls, procure and receive stock, execute preparation, record actual consumption and costs, then learn from outcomes.

Suggested positioning to test: **A preorder and kitchen planning tool for small home-food businesses that helps owners keep delivery promises, reduce ingredient waste, and see which orders are worth taking.**

Start with one segment, such as scheduled lunch-box sellers, rather than simultaneously serving meal subscriptions, custom cakes, catering, and every other home business. These segments have different scheduling, customization, and purchasing needs.

## Objective 1: Flexible date-based preordering and scheduling

Implemented in `backend/myapp/services/scheduling.py`, `views/orders.py`, `views/kitchen.py`, and the checkout/planner UI:

- Future delivery dates, advance notice, daily menu capacity, business hours and kitchen closures.
- Backward preparation scheduling around one worker and one unit of each named resource.
- Batch-scaled preparation steps, unattended work, permitted waiting gaps and delivery buffers.
- Stored preparation plans, owner preview/confirmation for replanning pending orders, and checkout locking.

Highest-value extension: **date-first browsing with feasible slot suggestions**. Customers currently choose an arbitrary date/time and ask the system to check it. Show available dates and several feasible times before the customer invests in a basket. An item-level slot is only advisory: the combined basket must be checked and checkout must revalidate atomically.

Add pickup as a real fulfillment type, with pickup windows and no delivery-address requirement. Add service-zone eligibility and owner-configured delivery fees; a free-text service area and a flat fee do not establish whether a specific address is serviceable.

Build a controlled order-change workflow: customer requests a new date, server previews capacity/price effects, owner or policy approves, old reservations are replaced atomically, and the change is recorded. Existing preparation-plan review does not constitute delivery-date rescheduling.

For unpaid bank-transfer orders, introduce payment deadlines and explicitly provisional capacity reservations. Keep cash-on-delivery reservations distinct: an unpaid COD order is not automatically abandoned. Release capacity according to the selected payment policy, and require a fresh check if payment arrives after expiry.

Only add multi-worker scheduling, equipment quantities and batch pipelining when pilot sellers demonstrate the need. Current conservative scheduling can reject a feasible arrangement, but a comprehensible scheduler is more useful than an unvalidated optimization claim.

Acceptance evidence: booking success, time to find a feasible slot, scheduling conflicts, on-time fulfillment, and concurrent attempts at the final available slot on a separate PostgreSQL test database.

## Objective 2: Ingredient freshness and storage monitoring

Implemented in `models.py`, `serializers.py`, `services/freshness.py`, `views/orders.py`, `views/planning.py` and `views/costs.py`:

- Separate ingredient batches, expiry sources, storage locations, supplier text and documented guidance.
- Opening/thawing deadlines, handling holds, earliest applicable expiry and exclusions.
- First-expiring-first-out cooking deduction, rollback on shortages, and repeat-deduction protection.
- A planning allocation that avoids assigning the same stock twice and excludes batches expiring before preparation completes.
- Waste records with cost snapshots and stock deduction.

Highest-value extension: **an actionable stock and purchasing plan**. For each upcoming order, show covered quantities, procurement-dependent quantities, purchase deadlines and unresolved risk. Distinguish physical stock from planned purchases and from allocations; a purchase order must not increase usable stock before receipt.

Introduce supplier lead times, pack sizes and minimum purchase quantities. Generate a draft purchasing list from confirmed orders first. Optional forecast demand must appear separately, so it is not accidentally added twice to confirmed demand.

Add ingredient-to-preparation-step mapping when multiday recipes need it. Current planning conservatively checks stock through preparation completion; explicit use times would support more accurate allocation, provided subsequent prepared-food storage is separately documented.

Add **batch traceability** using structured consumption records linked to order items and inventory batches, with quantity, unit and cost at consumption. Today `InventoryLog.reference` contains text such as `Order #123`; this is a useful audit clue but weaker than relational traceability. Prevent deletion from removing needed batch identity and snapshot evidence.

Use this record to answer: which orders used a held/recalled batch, which remaining batches are affected, and which customers require an owner-managed follow-up? Add an internal investigation workflow before considering automated messages.

Prefer owner actions such as “review this batch,” “purchase this shortfall” and “record waste” over a prominent aggregate freshness percentage. The existing percentage is an equal-weight recorded-time indicator, not a food-safety measurement. A small batch and a large one count equally, and a date-valid batch may still have unrecorded handling problems.

An optional menu-use suggestion can identify recipes using eligible stock before its recorded deadline. Apply eligibility, handling and preparation constraints first; waste reduction must not override them. Hour-level handling rules require appropriate documented guidance and a timestamp model, not invented food durations.

Acceptance evidence: stockouts during preparation, discarded quantity/cost by material, inventory-entry time, and time to trace a batch to affected orders. Compare periods with similar order volume and menu mix; do not infer waste reduction from synthetic data alone.

## Objective 3: Personalised single-vendor storefront

Implemented: separate public pages, seller story, founder information, food philosophy, contact/social information, menu media links and delivered-order review eligibility. See `views/storefront.py`, `Storefront` and the business-page components.

Highest-value extension: **easy seller onboarding and low-friction ordering**. Add persistent photo upload from a phone, logo/theme settings, pickup details, clear portion/serving information, and a short setup wizard. Offer recipe templates and sensible setup defaults without inventing safety data. Measure whether sellers can publish a useful menu without developer help.

Add guest checkout or a low-friction verified-contact flow. The cart currently requires authentication, which creates a step before a first purchase. Measure abandonment before deciding whether a particular login approach is best. Add account recovery for returning users.

Support shareable links to a specific menu/date/drop and campaign attribution. An owned storefront does not itself create traffic; test the flow from sellers' existing social audiences to completed orders.

For a startup serving multiple sellers, preserve one vendor per customer storefront while introducing tenant-scoped records, memberships, permissions and routing behind the scenes. The current application uses `Storefront(pk=1)` and global records, so it is a single-kitchen application, not an isolated multi-seller SaaS platform. A separate deployment per pilot seller is a possible temporary approach, with operational overhead.

Single-vendor design and multi-tenant hosting are compatible. Tenant separation is required before sharing one production database between independent sellers, but is unnecessary solely to satisfy the stated FYP objective.

Acceptance evidence: seller setup completion/time, customer checkout completion, brand recall/trust feedback, and cross-tenant access tests if SaaS support is added.

## Objective 4: Sales analytics for business decisions

Implemented: 28-day net food sales, paid-order count, average order value, seven-day trend, all-time gross menu sales, baseline/trend demand estimate, current recipe contribution estimates, operating expenses and waste costing. See `views/planning.py`, `views/admin.py`, `views/costs.py`, and `services/forecast.py`.

Highest-value extension: **historical order contribution and an action-oriented owner dashboard**. Snapshot recipes and order commercial terms at acceptance; record actual batch cost at consumption and packaging/other direct costs when incurred. Allocate order discounts consistently across items. Separate missing cost data, estimates and actuals.

Report contribution after discounts and direct costs; include payment fees, delivery subsidy and labor assumptions where available. Do not label contribution as net profit. Show cash collection, fulfilled sales and future bookings separately, using the appropriate event date rather than one ambiguous sales date.

Answer useful questions: Which dishes earn the most contribution per hands-on kitchen hour? Which orders lose money after delivery? What is due to be purchased tomorrow? How much waste came from each ingredient? Which customers return?

For shared batch work, attribute labor consistently rather than adding the full batch duration to every order. Preserve assumptions visibly.

Keep forecasting modest. The existing model forecasts aggregate incoming paid portions by order-created date; it is not a per-menu forecast of portions to cook on delivery dates. Expand to menu/day-of-week forecasts only with enough history, compare against simple baselines using rolling chronological evaluation, and show errors and uncertainty. Confirmed bookings remain the primary production input.

Acceptance evidence: order-contribution reconciliation against controlled examples, time to answer business questions, accuracy of seller decisions in scenarios, and forecast error against baselines. Do not claim increased seller profit merely because profit-oriented charts exist.

## Objective 5: Recommendations, decision fatigue and conversion

Implemented in `services/recommendation.py`: explainable scores from purchase categories, repeat products and recent popularity, current-stock filtering and a fallback for users without history. The live endpoint allows previously purchased menus. The UI shows up to ten recommendations.

Important gaps:

- Recommendations require login; the cold-start fallback is for authenticated users with little history, not anonymous visitors.
- Availability is based on stock today, with no requested delivery date, quantity or kitchen schedule. This can hide a perfectly feasible future preorder awaiting procurement or recommend an item unavailable for the desired slot.
- Non-cancelled order quantities inform popularity and purchase history even when unpaid. Treat provisional orders as weaker intent and completed purchases as stronger evidence, with a policy appropriate to COD.
- No recommendation exposure/click/purchase experiment currently proves conversion improvement.

Highest-value extension: **a short guided choice flow** asking date, headcount, budget and preferences. Return three clearly different choices, with a small set of editable constraints and an option to browse everything. Support a guest/session fallback and avoid requiring a lengthy profile.

Separate hard constraints from ranking: date feasibility, portion availability and seller-declared dietary exclusions come first; preference, novelty and popularity come afterward. Explicitly represent unknown dietary information; do not infer allergen absence or cross-contact safety from a dish name.

Use the same date-aware availability service as the catalogue and checkout. Explanations should be specific, such as “fits your budget for four” or “similar to your previous lunch order.” Margin or waste-related preferences can be bounded seller-side considerations only after customer suitability and stock eligibility, and should not masquerade as customer preference.

Instrument recommendation impressions, rank, algorithm version, selected context, clicks, basket additions, checkout and paid completion. Deduplicate purchase events and define attribution windows. Avoid storing unnecessary personal information.

FYP evaluation: compare ordinary browsing, popularity ranking and guided personalised ranking. Use counterbalanced tasks with comparable difficulty to measure time to choose, task completion and self-reported effort. Offline ranking metrics require sufficient real history and temporal splits; they do not establish conversion lift.

For live conversion claims, use a randomized, consistent session/user assignment and a predefined denominator such as eligible exposed sessions. Small studies may support usability findings without supporting a statistically reliable sales-lift claim. Report uncertainty and unsuccessful results honestly.

## Reliability fixes before a real launch

1. **Preserve accepted recipes.** `OrderItem` snapshots name/price/quantity but not ingredient quantities. Both shopping calculations and cooking use current product ingredients. Editing a recipe can silently change an accepted order's ingredient needs. Add versioned recipe snapshots and explicit amendment handling; keep historical preparation plans consistent with the recipe used.
2. **Record payment events and refund outcomes.** `admin_order_detail` accepts payment-status changes but does not execute a refund or require reconciliation evidence. Changing a flag must not be presented as moving money. Add amount, method, reference, actor and time; support pending/completed/failed refunds and partial refunds only when implemented. Existing manual transfer confirmation can remain a pilot workflow.
3. **Restrict customer-management operations.** `AdminCustomerViewSet` exposes a full model viewset over all users, and `UserSerializer` allows `is_staff` and `is_active` edits. The UI's owner-account guard is not an API guard. Limit role changes and account deletion to explicitly authorized operations; protect owner access.
4. **Preserve order history when handling accounts.** `Order.user` uses cascading deletion, so deleting a customer through the generic endpoint can erase orders and their items. Prefer deactivation for ordinary owner operations and design a separate retention/anonymization workflow.
5. **Harden signup and recovery.** The custom signup function calls `create_user` without invoking the configured password validators. Add explicit validation, input bounds, recovery, and abuse controls; verify host-level protections separately. Do not assume settings alone validate custom signup.
6. **Preserve inventory auditability.** Prevent routine deletion of consumed batches; record adjustment reasons rather than relying only on direct quantity edits. Existing stale-edit protection is valuable and should remain.
7. **Verify real operations.** Test PostgreSQL concurrency, backup restoration, monitoring, reminder delivery and critical customer/owner browser journeys in staging. Passing SQLite tests does not establish production locking behavior or external-provider reliability.

These are source findings and implementation priorities, not claims of observed production incidents.

## Recommended implementation order

### First: stabilize commitments and collect evidence

Implement recipe snapshots, structured consumption, protected history and payment-event records. Add minimal conversion instrumentation now, so subsequent changes can be evaluated. Resolve role-management and signup weaknesses before a live pilot.

### Second: build one complete standout workflow

Connect date-first recommendations and feasible slots to purchasing shortages and actual fulfillment. Add a seller action list: orders needing attention, ingredient purchases due, batches requiring review and upcoming preparation. Reuse the existing scheduler and planner instead of building a second availability engine.

### Third: make decisions measurable

Add historical contribution and evaluate guided recommendations against a baseline. Run seller and customer task studies. Demonstrate an order's entire path, including a stock shortfall, a recipe amendment, preparation, cost recording and an exception/refund.

### Fourth: validate a small startup pilot

Recruit a proposed initial cohort of 3–5 sellers in one segment for 2–4 weeks, adjusted to availability; this is a learning pilot, not a representative market study. Observe their existing WhatsApp/spreadsheet process before introducing the app. Measure admin minutes per order, missed commitments, ingredient waste cost, recurring usage, setup time and support burden. Seek willingness to pay for observed value, rather than asking only whether they like the idea.

A candidate north-star measure is **orders fulfilled on time with known positive contribution per active seller per week**. Track missing-cost coverage separately so unknown orders do not disappear from accountability. Guardrails include cancellations, complaints, waste and owner workload.

Test a simple seller subscription or usage-based model after costs and willingness to pay are understood. No price recommendation is justified from this code review alone.

## Useful additions after the core workflow

- One-tap reorder with date, price, stock and capacity revalidation.
- Weekly menu releases and opt-in reminders for sellers with repeat demand.
- Waitlists with clear allocation/notification policies.
- Mobile photo upload, printable labels and consolidated preparation/packing lists.
- Owner-entered orders from WhatsApp that pass through the same scheduling and inventory rules.
- Structured portions, variants and bundles with explicit recipe/capacity effects.
- Recurring meal plans only after validating repeat schedules, skips, cutoff rules and refund behavior.

Defer a marketplace, extensive blockchain/payment experimentation, AI image-based safety claims, complex routing, a native app and sophisticated forecasting until there is direct evidence they solve the pilot's main problem. The existing escrow demo adds less value to this product direction than reliable payment records and fulfillment.

## Current competitor context

Checked official product material on 29 September 2026:

- [Hotplate product](https://www.hotplate.com/product) advertises branded storefronts, preorder windows, pickup times, inventory controls, notifications and preparation lists.
- [Cococart features](https://www.cococart.co/resources/cococart-features) describes inventory, bundles and calendar fulfillment/preorders; its [checkout guide](https://support.cococart.co/en/articles/15517124-how-does-the-standard-checkout-work) describes fulfillment selection and payments.

This establishes that branded preordering is an existing product category, not a novel feature by itself. It does not establish either competitor's full technical coverage or prove they lack your proposed features. Your plausible differentiation is the integration of ingredient-batch planning, constrained kitchen scheduling and order contribution for a narrow seller segment. Validate it through hands-on competitor workflows and seller interviews before making uniqueness claims.

## Verification performed

- Backend: 87 tests passed using the documented isolated in-memory SQLite configuration with dotenv disabled.
- Frontend: all 10 existing utility tests passed.
- Frontend production build: passed. The initial sandbox run hit a child-process permission error; the permitted rerun succeeded.
- No live production records were inspected or modified. No new application features were implemented.
- No end-to-end browser inspection, external payment/email validation, PostgreSQL concurrency test, or user study was performed in this review.

The priority is implementation depth plus demonstrated outcomes. A coherent, evaluated workflow across the five objectives will be more convincing than a longer feature list.
