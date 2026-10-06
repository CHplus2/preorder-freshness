# Recommendation resilience verification

6 October 2026. Isolated local site and temporary SQLite database; dotenv disabled. No production data changes or purchases.

Changes:
- Validate guide results before rendering; malformed rows become recoverable errors rather than render failures.
- Optional session storage failures no longer throw from recommendation rendering or prevent adding to the basket.
- Changing date, portions, budget or category clears previous results and invalidates pending responses.
- Click telemetry no longer delays the cart request.

Verification:
- 24 backend commitment tests passed, including new paused/archived, weekday and category exclusion coverage.
- npm test, lint and production build passed. New frontend tests cover malformed rows/slots, valid empty results and blocked optional storage.
- Browser RM 1 budget returned no matching times; changing to RM 30 removed the old message immediately, then returned three menus with times.
- Stopping only the isolated server produced a connection error and removed suggestion cards. Restarting and submitting again restored suggestions and cleared the error.
- Screenshot: recovered.png.

Limits: synthetic owner session used to view the public guide. No add-to-cart browser action in this batch, no new mobile check, no real participant evaluation or conversion measurement. Storage blocking and malformed responses were automated unit checks, not browser fault injection. Native date input required an arrow key event after filling and used November 12 within the permitted horizon.
