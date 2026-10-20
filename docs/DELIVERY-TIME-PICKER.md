# Delivery-time choices — 20 October 2026

Customers choose from kitchen-checked times in the basket and checkout. They do
not have to enter arbitrary hours and interpret recipe-planning errors.

- Suggestions load automatically after the basket is ready. A preferred date is
  optional; unavailable/full preferred dates automatically fall forward to the
  next day found by the bounded search.
- Selecting a time keeps the choices visible and marks the selected button.
  The choice carries into checkout through navigation state as well as browser
  session storage. Selecting a time does not start another slot search.
- Quantity or preparation-setting changes invalidate the old basket choices.
  Changed preferred dates abort old searches; late replies cannot replace the
  newer date's results.
- Checkout rechecks a carried time against current bookings. If it now needs
  review, fresh alternatives load and the normal submit action stays disabled.
  The customer can select an alternative or explicitly ask for kitchen review.
- **Need a different time? Ask the kitchen** opens the optional manual date/time
  field. Its unconfirmed-request status, no-payment behavior and lack of reserved
  preparation are explained separately from scheduled preorders.
- A seven-day search with no results offers **Check the following week**. An
  excessive quantity or a basket with no common delivery weekday is detected
  immediately, with guidance to adjust quantities or split the basket. Changing
  dates cannot solve these structural constraints.
- Network errors and malformed responses show retry controls, not an invented
  empty availability list. Retrying a following-week search keeps that range.
  Detailed recipe constraints are collapsed when owner review is necessary.

The existing scheduler, working hours, notice, capacity, step dependencies,
waiting/storage limits and checkout locking remain authoritative. Suggestions
are hourly (09:00–21:00 Malaysia time), not exhaustive minute-by-minute searches;
each request searches at most seven days after the notice/preferred date. They
do not reserve stock or kitchen capacity. Final checkout still rechecks and can
return an unpaid review request if another booking changes availability.

## Verification

- Full backend suite: **534 tests**, **11 environment-dependent skips**. New
  checks cover automatic fallback from a fully booked date and immediate
  structural-basket responses without running futile date searches.
- Frontend utility, checkout, shopping-assistant and UX suites pass. Five new
  utility cases validate time conversion, date ranges, malformed/duplicate
  suggestions, following-week boundaries and basket-setting invalidation.
- Production build and changed-source lint pass.
- Actual local browser/API/session/CSRF flow covers automatic loading, preferred
  day fallback, stable selected choices, quantity changes, another owner booking
  making a carried time unavailable, explicit custom-request mode, recovery and
  successful scheduled COD checkout. The resulting fictional order has accepted
  recipe snapshots, unpaid status, no stock deduction and a cleared basket.
- Additional fault injection checks seven-day empty results, failed next-week
  requests/retry, malformed data and an abandoned date's late reply.
- Cart and checkout pass document-width, grid/touch-target and automated WCAG
  A/AA checks at **1440, 390 and 320 pixels**, with no browser page errors.

All data writes for verification used an isolated fictional database. This does
not change Supabase orders, menu rules, models or payment-provider settings.
