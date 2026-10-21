# Menu recommendations: quick discovery and optional date refinement

The storefront provides two entry points to one explainable recommendation
approach. A visible **Recommended for you** row offers up to three photo cards,
prices, reasons and an Add 1 action. **Get suggestions for a date** opens the existing date
finder, labelled **Menu suggestions for your date**. It explicitly leaves catalogue filters unchanged. That finder returns the same card layout with a requested portion total
and separate suggested delivery times for each menu.

The layout follows the food-first direction of the supplied Swiggy/Talabat
references: recognizable food photos, a small choice set, clear prices and
reachable actions. The form is optional, following progressive disclosure.
Search, category controls and the primary catalogue appear first. Supporting
recommendations follow the first two complete menu rows: eight menus on desktop,
six on tablet and four on phones, or the entire catalogue when it is smaller.
They are hidden during active catalogue searches/category filtering so unrelated
suggestions do not distract from those results. The underlying catalogue order
and pagination are unchanged.

Recommendation cards use 64–76 pixel thumbnails instead of large hero photos,
with responsive image sizes matching those thumbnails. Quick suggestions show
one reason, price and an Add action. Date-specific cards retain the fuller
reasons and time choices. Desktop shows three supporting cards together. Phones
use a horizontally scrolling row with previous/next controls and a visible next
card. Date-specific results stack on phones for readable time choices.

## Recommendation behavior

Both entry points use the existing weighted rules:

- A category among the customer's frequent paid-order categories: +25.
- Previously bought menu: +5 per recorded portion, capped at +20.
- Recent paid-order popularity: square-root weighting, capped at +15.

Unpaid and cancelled orders do not contribute. The existing history windows and
created-at basis for recommendation preferences are unchanged; this is separate
from FreshCast's delivery-date forecasting. No new forecasting model or training
artifact is introduced.

Only active menus with ingredient recipes enter these suggestion sets. When
personal evidence contributes, the cards explain it. Guests and customers with
no relevant history receive popularity-based suggestions, or a deterministic
menu-discovery set when no popularity evidence exists. The UI does not invent
ratings, seller endorsements or personal preference evidence.

Automatic cards do not require current stock and do not promise a delivery time.
The date finder additionally checks delivery weekdays, the entered food budget,
portions and automatic kitchen scheduling. Its bounded search checks up to 30
ranked candidates for up to three matching menus. A suggested time applies to
that menu individually. Checkout rechecks the full basket. Food totals precede
bulk discounts and delivery fees. Allergen suitability is not inferred.

## Available endpoints

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `POST /api/menu/suggestions/` | Public, rate limited | Empty JSON input. Returns `{session, basis, results}`; basis is `history`, `popularity` or `menu`. Up to three rows contain `id`, `name`, `image_url`, `price` and `reasons`. No delivery slots are asserted. Creates a recommendation request record. |
| `POST /api/menu/guide/` | Public, rate limited | Required date within 90 days, portions 1–100, optional total food budget and category. Existing session/results/message contract; rows include portion totals and suggested slots. Optional `empty_reason`: `category_unavailable`, `no_menu_match` or `no_kitchen_times` (null on success). |
| `POST /api/recommendation/events/` | Public, session bound | Existing impression/click/added events, allowed product identities and duplicate-event checks. |
| `GET /api/admin/recommendation-metrics/` | Staff | Existing rolling engagement/outcome report. Both storefront surfaces contribute to its combined figures. |
| `GET /api/recommendation/` | Signed-in customer | Existing legacy recommendation response remains available. |

The finder shows a summary of the submitted date, portions, category and budget.
Empty results explain whether the selected category has no eligible menus,
preferences did not match, or no automatic kitchen times were found. **Search
all categories** preserves the date, portions and budget and repeats the search.
The form presents date/portion limits and native validation; valid preferences
may still return the same menus when the same choices satisfy them. The system
does not recategorise menus or silently ignore the customer's selected category.

No database migration is required. Request context distinguishes `menu_cards`
(`instant-menu-v1`) from `date_guide` (`date-guide-v1`). The existing experiment
flag and browser assignment are shared across both surfaces.

Impressions are recorded after results render; a closed date finder does not
record an impression for a response it has not displayed. Card/detail selection
or an add action saves that recommendation session for existing checkout
attribution. Loading another suggestion set does not replace a previously
selected session. Direct card adds also record an added event after the basket
POST succeeds. Telemetry failures do not block shopping. Events are not a
complete sequential funnel; adding later from a meal detail page need not
produce a card-added event. The server still requires a rendered session, a
matching order product, the same browser key and the 24-hour attribution window.

## FYP Objective 5

This implements an explainable, history- and context-aware menu recommendation
system with immediate discovery and optional refinement. It supports the aim of
reducing decision fatigue and helping customers progress to a purchase. Measured
improvement still requires evaluation: decision time/user feedback and a suitable
conversion comparison. Recorded engagement or synthetic demonstration records
alone do not establish causal conversion lift.

## Verification

Backend tests cover a bounded active set, missing recipes, paused/archived menus,
no-stock discovery, personal versus guest evidence, unpaid/cancelled exclusions,
existing experiment assignment, session-bound events and duplicate impressions.
Existing date guidance and attribution tests are retained. Frontend checks cover
response validation, shared card rendering and optional refinement. Isolated
Chromium journeys exercise guest/history states, card adds, guided adds, request
invalidation, closed-finder exposure, retry and genuine empty results at desktop,
tablet and phone widths. No production records or provider payments are changed.

The menu-first revision was checked with 30 backend tests, frontend utility/UX
regressions and a production build. Ten responsive accessibility states cover
menu ordering, the compact row, empty Bakes recovery and date results at 1440,
768, 390 and 320 pixels. No automated WCAG A/AA violations, document overflow or
page errors were reported. The browser check confirms that clearing the category
preserves other inputs, active catalogue filters hide unrelated recommendations,
and invalid date/portion/budget ranges do not send a request.
