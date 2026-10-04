# Basket delivery guidance — batch 3

Checkout displays the intersection of delivery weekdays for all basket items. If menus have no common weekday, a visible explanation directs customers back to the basket. An incompatible selected date identifies the affected items and the valid common weekdays. Availability, time suggestions and submission are disabled while incompatible; server-side validation remains authoritative.

Unrestricted baskets retain the existing simple checkout. A weekday match does not promise kitchen capacity: customers still check available preparation and delivery times. Quote and slot cache keys include weekday rules so refreshed menu restrictions do not retain stale suggestions.

Guidance uses 16px/20px padding, 24px separation below the panel, 8px paragraph spacing and a 44px review-basket link. No database migration required.

Validation: frontend utility suite, checkout result rendering, guidance rendering and targeted lint pass; production build passes. Authenticated browser end-to-end layout verification was not performed for this batch.
