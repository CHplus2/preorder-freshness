# Basket delivery guidance — batch 3

Checkout displays the intersection of delivery weekdays for all basket items. If menus have no common weekday, a visible explanation directs customers back to the basket. An incompatible selected date identifies the affected items and the valid common weekdays. Availability, time suggestions and submission are disabled while incompatible; server-side validation remains authoritative.

Unrestricted baskets retain the existing simple checkout. A weekday match does not promise kitchen capacity: customers still check available preparation and delivery times. Quote and slot cache keys include weekday rules so refreshed menu restrictions do not retain stale suggestions.

Guidance uses 16px/20px padding, 24px separation below the panel, 8px paragraph spacing and a 44px review-basket link. No database migration required.

Validation: frontend utility suite, checkout result rendering, guidance rendering and targeted lint pass; production build passes. Authenticated browser end-to-end layout verification was not performed for this batch.

## Basket suggestion explanations and recovery controls

`POST /api/orders/slots/` keeps its `slots` array and adds
`unavailable_reason` (a string, empty when suggestions exist). When no hourly
candidate fits, this is the last scheduler validation reason, not proof that
all possible minute-by-minute or manually arranged plans are impossible. The
search includes 09:00 through 21:00 Malaysia time and uses one request-time
snapshot. No capacity, advance notice, early-finish, storage or equipment rule
is relaxed. Database failures remain service errors, never empty availability.

The basket shows menu advance notice and quantities above the menu's own daily
limit before searching; existing bookings are counted on the server. A request
above a menu's daily limit cannot be solved simply by choosing a later date.
A same-day basket needing 24 hours' notice cannot be automatically scheduled
for today. The empty state displays the server reason and distinguishes owner
review from confirmed availability. A new date clears the previous result and
cancels its pending request. Only selected, current-date suggestions transfer
to checkout, where the complete basket is checked again.

Low-frequency recovery downloads are collapsed under **Settings → Advanced →
Backups & recovery**. `/admin/settings#backups` still opens the controls directly.
The model-release link points at the owner's published `freshcast-model-backup-v1`
release; the deployment credential workflow remains documented in GitHub rather
than occupying the everyday Settings screen. These controls do not export the
kitchen database or modify orders.
