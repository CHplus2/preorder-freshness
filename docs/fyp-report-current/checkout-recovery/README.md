# Checkout recovery layout — 9 November 2026

The checkout startup error now uses the existing neutral page-state layout instead of a coloured error card. It shows a concise message, Retry and Basket actions. Retry is disabled while kitchen/basket requests run. Loading remains a status rather than an error. A basket-specific error retains its own message.

- [Laptop screenshot — 1366 × 768](Checkout_Unavailable_1366.png)
- [Phone screenshot — 390 × 844](Checkout_Unavailable_390.png)

These are actual captures of the current application running locally with isolated example data. A storefront HTTP 503 was deliberately injected locally to show the error state; the images are not evidence of a live production outage. No receiving QR or real payment evidence appears in these images. No existing numbered report figure shows this transient state, so these are supplementary screenshots rather than replacements for Figure 4.7.

The local browser check verified a failed retry, a disabled Retrying button while requests run, a subsequent successful request to the real local endpoint, restored checkout and the same one-item basket. Laptop/phone layouts had no horizontal overflow or page errors. Build, ESLint and checkout regression checks passed. This is source publication, not verified Vercel deployment. No backend, model or inventory-policy changes were made.

Browser_Checks.json records the measured spacing and scenario results. The full Word/PDF was not rebuilt for this UI follow-up.
