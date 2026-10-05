# Delivery weekday verification

Executed locally on 5 October 2026; recorded 6 October. Synthetic owner/buyer data in isolated SQLite; dotenv disabled. Production data was not changed.

## Change

The basket previously listed individual delivery weekdays but deferred a combined conflict explanation until checkout. It now shows shared delivery days, explains incompatible menus and disables checkout until the basket is compatible. No redundant link back to the current basket is shown.

## Observed results

- Chicken rice Monday + Vegetable rice Saturday: conflict visible and checkout disabled (desktop and 390px mobile screenshots).
- Removing Vegetable rice: Monday guidance shown and checkout enabled.
- Checkout on Thursday 12 November: weekday explanation and disabled availability/order controls.
- Changing to Monday 12 October, 15:00: availability endpoint returned success and visible confirmation.
- Pausing Chicken rice while already in the basket: checkout reload showed the unavailable item and Review basket action.
- Automated backend tests: 13 passed across delivery weekdays and menu lifecycle, including mixed baskets, live basket rule changes, paused menus and accepted snapshot preservation.
- Frontend component UX tests, lint and production build passed.

Native datetime automation required an arrow-key change after filling the input; the verified dates above are the dates visibly rendered after that change. No order or payment was submitted in this batch. Accepted-order preservation was tested at service level, not newly through the browser.

Screenshots: conflicting-basket.png and mobile-basket.png. Mobile review also identified the existing floating Kitchen help launcher overlapping part of the checkout area; this remains a follow-up UX issue.
