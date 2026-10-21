# Home-kitchen UX improvement batches

## Direction

The supplied Talabat, Swiggy and OpenTable screenshots inform food discovery,
compact kitchen information, clear quantity controls and an obvious next action.
This application serves one home kitchen: retain Dapur Kita's green identity,
preorder notice and capacity checks. Marketplace promotions, invented ratings,
instant delivery claims and new social sign-in providers are not implied by the
references. The following priorities are usability judgments applied to this
implementation, rather than a claim of research with customers.

## Batch 1 — Menu discovery and meal details

Implemented on 20 October 2026:

- Replaced the large catalogue hero with a compact kitchen introduction so food,
  search and category controls appear earlier on phones and desktop. The kitchen
  contact link, service area and configured group discount use existing records.
- Moved optional guided date discovery below the food, retaining a shortcut that
  opens it and focuses the date field. Ingredient records remain secondary.
- Fixed reselecting an already active category: it previously cleared results
  without triggering a new request, leaving an indefinite loading state.
- Added clear filter recovery. Genuine empty menus and failed/malformed responses
  have different messages; failures retain a retry instead of reporting no food.
- Displayed restricted delivery weekdays on food cards alongside existing price,
  notice and quantity controls.
- Reorganized meal details into photo, name, price and ordering controls, followed
  by advance notice, delivery days, daily limits and an allergy contact action.
  Quantity and food subtotal are shown before adding; a successful addition links
  directly to the basket. Mobile keeps the purchase action at the bottom.
- Preserved reviews, image fallback, accepted menu status, sign-in requirements,
  account isolation and cart API behavior. Paused/archived details remain readable
  for earlier links, while their purchase controls are disabled.

The basket action remains a food subtotal: delivery and any group discount are
calculated in the basket/checkout. A daily menu limit is not a promise of remaining
capacity. Advance notice is measured before preparation, not simply delivery.
The privacy boundary remounts pages when signing in/changing accounts; no private
basket state is carried between accounts.

## Batch 2 — Owner orders and Planner

Implemented on 20 October 2026:

- Orders opens with active orders sorted by delivery, rather than completed
  history. Shortcuts show open orders, pending confirmation, ready/on-the-way,
  past-due and all customer orders. Search stays visible; less-used filters are
  grouped under More filters. Completed/cancelled records remain accessible.
- Generated history retains its separate view. Clearing filters preserves that
  source. Selecting a completed status switches to All orders, so the default
  active-work scope does not silently hide completed records.
- Preparation links open and focus the specific order in Planner. Query-string
  navigation updates the Orders view, including links to a completed order.
  The past-due preparation follow-up link opens the matching order queue.
- Update status names the existing edit action more clearly. Preparation,
  payment records and accepted recipes remain separate actions.
- Loading or failed order refreshes hide cached record mutation controls. Retry
  restores the queue from a successful read; a failed request is not an empty
  order list.
- Planner shows a counted Kitchen follow-up panel. Details and maintenance tools
  open on request; a successful cooking-step check appears after actionable
  exceptions within that panel. Missing accepted recipes remain visibly flagged
  before shopping.
- The date bar and compact workload summary lead the selected day's work. The
  monthly calendar opens with Choose from calendar. Daily updates use shorter
  explanations while retaining the ingredient-deduction and payment distinctions.
- The review panel's catalogue lookup is mounted only when expanded, avoiding an
  extra catalogue request during normal daily planning.

Verification: order-queue utility tests, Planner rendering/guard tests, existing
frontend utility/UX regressions, changed-file ESLint and a production build pass.
Local Chromium journeys exercise shortcut/search combinations, generated history,
completed-order links, missing-date review, failed-refresh recovery, the specific
order-to-Planner link, an actual plan preview/confirmation, calendar/view changes
and an actual delivery update that leaves payment unpaid. Eight page/viewport
checks at 1440, 768, 390 and 320 pixels report no automated WCAG A/AA violations
or document overflow. Desktop and phone screenshots were also inspected.

These checks use fictional records in an isolated SQLite database. This batch
changes frontend presentation/filtering/navigation, not production records,
server scheduling/payment/stock rules, forecast models or API schemas.

## Batch 3 — Inventory priorities and shared FreshCast navigation

Implemented on 21 October 2026:

- Inventory shows one stock-attention priority at a time, with visible group
  counts, three initial batch previews and Show all. Held, past-expiry, today's
  expiry, upcoming expiry and missing-date groups stay mutually exclusive.
  Remaining quantity, recorded value, incomplete costs and batch identity stay
  visible in the selected group's evidence.
- Held batches are excluded from the expiry-only summary counts and have their
  own table filter/status. Invalid calendar dates need review instead of rolling
  forward into a valid shelf-life category. Date checks use the Malaysia day.
- Removed duplicate top-level batch/ingredient totals; those counts remain with
  their lists. Search and filters have labels, reset and clearer empty states.
  Add ingredient, Add stock batch and Refresh records name the primary actions.
- Inventory reads are validated before replacing displayed records. A malformed
  initial response is a read failure, not zero stock. Failed refreshes retain an
  explicit warning and disable batch mutation entry points until records reload.
- Kitchen, Genpact and sample sources use the same FreshCast page headings and
  compact illustrated navigation across decisions, inventory evidence and demand
  analytics. Active navigation, source labels, provenance notices and context
  links remain available.
- All decision sources retain the five steps. Phones use a horizontal step bar
  that brings the active step into view without scrolling the whole page.
- Fixed a recommendation-label contrast issue and made the horizontally scrolling
  daily forecast chart keyboard-focusable.

The sources deliberately retain different controls and evidence: kitchen windows
use delivery-dated records, recipes and batch expiry; Genpact uses external center
and week selections with simulated operations; sample mode is explicitly a fixed
model-free example. Chart types and action capabilities follow those distinctions.
The original room illustrations, rescue tutorial and detailed evidence tools are
retained. No forecasting, allocation or scenario equations are changed.

Verification uses frontend utility/rendering regressions, changed-file ESLint,
a production build and local Chromium journeys. Kitchen requests use real APIs
against an isolated fictional SQLite fixture. Genpact success layouts use explicit
browser-only contract fixtures because the trained runtime is not part of the
local UI fixture. Those checks do not validate a trained Genpact model or accuracy.
External API failure is separately checked to stay an error without a sample
fallback. Thirty page/viewport checks cover Inventory plus three FreshCast views
for all three sources at 1440, 390 and 320 pixels. No automated WCAG A/AA
violations, page errors or document overflow were found after fixes. Screenshots
were also inspected. No production records or model artifacts are changed.

## Batch 4 — Home, customer orders, account and contact

Implemented on 21 October 2026:

- Home brings the current menu immediately after a shorter introduction. Phone
  cards pair a small photo with the meal name, price and notice. Decorative hero
  artwork stays on desktop; kitchen information and occasion discovery follow
  the food. Missing photos retain a neutral fallback.
- The public menu preview validates its read and distinguishes loading, a genuine
  empty menu and a failed request with retry. It no longer relies on shared
  product state or reports a request failure as a menu still being prepared.
  Group-offer copy uses only a valid configured percentage and item threshold.
- My orders separates Current, History and All orders, starts with current work
  when present, and renders ten records at a time with Show more. Completed and
  cancelled records remain available. Unknown statuses remain in Current.
- Loading/failed order refreshes hide cached cards and payment/delivery controls.
  Order cards retain requested-time warnings, payment status, original address,
  Sandbox disclosure, review links and delivery changes. Malaysia delivery times
  omit seconds and invalid/missing values prompt contact rather than show dates.
- Phone order progress keeps all five stages in a compact row. Order titles,
  filter counts and per-order contact actions have a clearer visual hierarchy.
- Account has separate profile/address sections and useful order/menu shortcuts;
  checkout appears only with a successfully loaded nonempty basket. New customers
  get a blank address form from the API's legitimate empty response. Invalid
  records do not become editable blank forms or successful save confirmations.
- Account saves disable their fields while running, retain drafts on errors and
  distinguish an unverified save from success. Editing removes the prior Saved
  message. An existing order retains its address snapshot when the default changes.
- Contact uses a compact heading and puts the enquiry first on phones. An order
  link prefills its reference into an explicit messaging-app draft. The customer
  still sends it in their own app. Unconfigured contact channels remain clear;
  no email or WhatsApp message is sent by this batch.
- Shared mobile/account disclosures close on Escape and return focus to their
  toggle. Outside clicks dismiss them, and opening one closes the other.
- How it works and FAQs distinguish available slots checked on order submission
  from custom requests awaiting kitchen confirmation.

Verification: frontend utility and customer rendering regressions, changed-file
ESLint, a production build and Chromium journeys against an isolated fictional
SQLite database. Journeys cover actual profile/address saves, failed and malformed
reads, uncertain saves preserving typed entries, history pagination, order refresh
failure/retry, and order-specific contact drafts. Twenty page/viewport scans cover
home, contact, how-it-works, account and customer orders at 1440, 768, 390 and 320
pixels, with no automated WCAG A/AA violations, document overflow or page errors.
Desktop and phone screenshots were inspected as well.

These are customer presentation and navigation changes. Production records,
scheduling rules, payments, forecasting and API schemas are unchanged. Local
checks do not establish production deployment readiness or replace user testing.

## Batch 5 — Account forms, recovery, reviews and notifications

Implemented on 21 October 2026:

- Sign-in and registration share one account form and a consistent light dialog
  style. Removed duplicate legacy form CSS while retaining the shared owner-modal
  shell. Password controls support Show/Hide without changing the entered value.
- Registration explains username/password rules and optional recovery email.
  Existing sign-in passwords do not receive the new-password minimum-length rule.
  Fields and mode switching are disabled during an account request; closing remains
  possible. Server authentication and password policies remain authoritative.
- Account errors appear once inside the dialog, receive keyboard focus and retain
  the draft after rejected requests. Session-verification errors survive account
  isolation remounts. Only one account dialog is shown if a protected page requests
  sign-in while registration is already open.
- Dialogs start at the username field, keep Tab/Shift+Tab within available controls,
  and restore opener focus on dismissal. Shared keyboard containment includes
  disclosure summaries in owner forms. Background navigation ignores Escape from
  a foreground native dialog.
- Recovery waits for the initial session check before consuming a reset fragment;
  reading it is side-effect free under development StrictMode. Credentials stay in
  memory and the fragment is removed from the address bar after mounting. A new
  fragment on the same page opens its corresponding reset form. Incomplete links
  can restart recovery. Success bodies are validated before reporting completion.
- Recovery, sign-in, registration and sign-out errors explain their own uncertain
  outcomes instead of displaying unrelated order-submission instructions. Recovery
  requests retain the server's generic, non-enumerating acknowledgement.
- Customer reviews have a compact list, refresh action, rating labels, character
  count and public-information guidance. A blank/whitespace review is rejected
  before posting. Failed/uncertain posting preserves the words and directs the
  customer to refresh before retrying. Invalid access/read payloads are errors,
  not an empty list or permission to post. Existing delivered-order eligibility,
  one-review rules and pagination remain enforced by the server.
- Notifications sit below the header rather than over bottom basket/help controls.
  Errors persist until dismissed. Other messages dismiss after eight seconds,
  pausing while hovered or keyboard-focused. Dismissal works by keyboard and
  notifications do not take focus when they appear. Reduced-motion preferences
  disable notification entrance/exit animation.

Verification: utility and UX/rendering regressions, changed-source ESLint and a
production build. Chromium journeys use isolated fictional SQLite records for
actual account creation, sign-in, password reset, review pagination/posting and
basket actions. Email-request UI uses an explicit no-email response fixture;
no real emails, messages, payments or production record changes are made.
Twenty-four responsive accessibility checks cover account/recovery forms and the eligible
review form at 1440, 768, 390 and 320 pixels, plus notification states on phones.
No automated WCAG A/AA violations or document overflow were found. Screenshots
were inspected, notification pause/resume/dismissal was exercised, and owner
menu/inventory dialogs passed desktop/phone keyboard and layout smoke checks.
Recovery was also checked through Vite's development StrictMode runtime.

Authentication APIs, account isolation, scheduling, payment and forecast rules
are unchanged. This batch does not retrain or evaluate forecasting models.

## Batch 6 — Basket, checkout and payment recovery

- Basket edits share a pending-operation guard. Quantity, removal and checkout
  controls wait for the authoritative basket refresh; overlapping reads are
  cancelled. Failed or malformed basket reads show a retry rather than cached
  checkout actions or a false empty-basket message. Uncertain additions direct
  the customer to check their basket before repeating an addition.
- Discounts use integer cents and the same half-even rounding as the server.
  A RM 10.05 basket with a 10% discount now previews RM 1.00 off, matching the
  accepted order. Delivery still uses the existing pre-discount RM 50 threshold.
  Missing/invalid kitchen pricing blocks checkout with a retry action instead
  of showing an assumed discount or payable total.
- Delivery-address reads, edits and saves have separate states. A failed read
  cannot become a blank saved address. Save failures preserve the draft and
  receive keyboard focus; pending saves disable fields and cancellation. Saved
  addresses have an explicit confirmation and an account-management link.
- Checkout preserves the selected delivery choice, offers basket editing beside
  the totals and focuses submission errors with a My orders recovery link.
  Uncertain order retries retain the existing idempotency reference. Payment
  choices are disabled during submission; unavailable PayPal configuration is
  retryable and a selected unavailable method cannot be submitted.
- A delivery request needing kitchen review replaces payment choices with
  “Payment after kitchen confirmation.” It remains an unpaid request without
  reserved cooking tasks. This exposes the server's existing behavior clearly;
  it does not relax recipe, notice, capacity or scheduling rules.
- The mobile purchase bar has a shorter PayPal action. The custom date/time
  control stays within the checkout grid at 320 pixels. PayPal status pages have
  a primary My orders action; Sandbox labels and payment-verification rules are
  retained. Demo-wallet totals also wait for valid basket/pricing data, and
  navigation can use the address in router state when local storage is blocked.

Verification: checkout/pricing utility and rendering regressions, existing
frontend utility, UX and PayPal tests, changed-source ESLint and a production
build. Chromium journeys use isolated fictional SQLite records for basket
changes, failed-read recovery, address save/recovery, a scheduled COD order and
an unconfirmed delivery request. The accepted COD total matches the preview,
with no payment claimed. A simulated interrupted submission reuses its request
reference on retry. No production records, emails or real payments are changed.
PayPal paid/uncertain screen checks use explicit browser response fixtures;
no external provider transaction is run by this batch.
Thirty-one responsive accessibility checks cover basket, checkout, address forms,
custom requests, payment recovery and demo-wallet screens at 1440, 768, 390 and
320 pixels. No automated WCAG A/AA violations or document overflow were reported.
Desktop and phone screenshots were inspected; the 320-pixel custom date/time
grid overflow found during review was fixed before publication.

A final cross-page consistency pass follows this batch. The entire site audit is
not yet complete. Forecasting algorithms and model artifacts are unchanged;
this batch does not retrain or evaluate models.

## Batch 7 — Shared navigation and page-state consistency

- Every route has a fallback browser title and description. Orders, checkout,
  account, payment and kitchen screens no longer inherit the previously opened
  page's title. More specific titles, such as a meal's name, remain intact.
- Meal details retain the Menu section highlight. Demand analytics, Stock and
  expiry, and Decisions all retain the FreshCast kitchen highlight. Phone
  navigation uses the same selected-section cue as desktop, and the horizontally
  scrolling kitchen navigation reveals its current section on load and resize.
- Client-side navigation moves keyboard focus to page content and preserves the
  skip link. Changing filters within one route does not move focus. Initial
  account dialogs retain their existing focus behavior.
- Missing pages, failed page-code loads, signed-out pages and staff-only access
  use one readable heading, explanation and action layout. Dismissing the initial
  sign-in dialog leaves a working Sign in action. Failed code loads keep the
  site navigation and a reload action without erasing browser data.
- Long configured kitchen names fit the phone header. The basket indicator
  distinguishes an updating or unavailable basket from a recorded quantity.
  Existing purchase bars, kitchen-help placement and customer/owner typography
  remain appropriate to their respective workflows.
- Customers now distinguishes loading, successful empty reads, invalid/failed
  reads and uncertain activation changes. Failed reads hide cached mutation
  controls; failed changes require a refresh before another action. Activation
  buttons name their customer, pending updates block overlapping actions and
  table headers identify their row/column. Staff accounts remain read-only here.

Verification: utility, checkout, PayPal and UX/rendering regressions, changed-source
ESLint and a production build. Forty-eight cross-page responsive checks cover
customer and owner screens, all three sample-source FreshCast views, access and
recovery states, and long-brand/basket-failure states at 1440, 768, 390 and 320
pixels. No automated WCAG A/AA violations, page errors or document overflow were
reported. Screenshots were inspected. A separate deliberate page-chunk failure
checks reload recovery and the keyboard skip link. A fictional local customer's
activation was toggled off and back on to verify the pending-action guard and
successful server-response handling; its final access remains active.

Browser verification uses fictional isolated SQLite accounts and explicit error
fixtures. No production database changes, external messages or provider payments
are part of this batch. Authentication/authorization APIs, model artifacts,
forecast calculations and scheduling rules are unchanged. No model training or
accuracy evaluation was performed.

## Review status

The seven planned UI/UX batches are complete. This records local verification,
not a claim that every possible interaction or production deployment has been
validated. Further work can follow concrete issues found during showcase and
customer/owner use.

## Verification and boundaries

Batch 1 uses frontend utility/rendering regressions, changed-file ESLint, a
production frontend build and Chromium checks against an isolated SQLite fixture.
Browser verification covers menu filters/pagination/retry, product availability,
quantity/basket feedback and layout/accessibility scans at 1440, 768, 650, 390
and 320 pixel widths. All ten page/viewport scans passed with no WCAG A/AA
violations reported by axe and no horizontal overflow. Screenshots were also
inspected: an intrinsic image-height issue found visually was fixed so meal
names and details are not pushed below an oversized photo.

No production database records, scheduling rules, payment behavior, forecast
models or API schemas are changed by this batch. Local verification does not
establish production deployment readiness or replace user testing.
