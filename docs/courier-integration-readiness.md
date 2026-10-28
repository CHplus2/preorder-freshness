# Courier integration readiness

The current implementation is manual courier coordination. It supports saved
recipient details, human-reviewed copying, staff-entered courier reference/link/
phone, actual handover status updates and opted-in customer dispatch emails.
No GrabExpress API, test account, courier booking or live event subscription is
configured. Opening a WhatsApp draft also does not use the WhatsApp Business API.

## Required before implementing a provider adapter

Obtain official documentation and access for the seller's country and service.
Confirm with the provider which booking/tracking APIs, testing environment and
webhook facilities this account can actually use. A consumer Grab account or
website tracking link does not establish API entitlement. Sandbox availability,
regional coverage, onboarding time and charges have not been verified here.
Provider credentials belong in private server configuration, never client code,
Git or copied booking notes. Do not put a real token in an issue or chat.

The integration needs the documented authentication, pickup/recipient fields,
quote/booking/lookup/cancellation operations, rate limits, status meanings and
callback verification scheme. Use an isolated provider test account with approved
test addresses and numbers before permitting real bookings or charges.

## Booking and tracking contract to implement once access is verified

- Keep the website order ID linked to the returned provider booking reference.
  Use the provider's supported idempotency/reconciliation rules to avoid duplicate
  bookings, especially after an interrupted response. Never invent courier IDs.
- Review the accepted order address, contact, food readiness, pickup arrangement
  and arrival window before booking. A website dispatch target is a planning
  allowance, not a provider arrival promise or reservation.
- Store the provider reference server-side and let the owner/customer view the
  appropriate tracking record. Do not infer acceptance from a link or typed ID.
- Verify callbacks using the provider's documented method, deduplicate event IDs
  and reject invalid, stale or out-of-order transitions. An unauthenticated JSON
  callback must never mark an order dispatched, delivered or paid.
- Map actual courier collection to dispatch and actual successful handover to
  delivery, subject to the website's valid transitions. Failed attempts, returns
  and cancellations require an explicit exception path, not a false delivery.
- Courier events do not verify food preparation, take payment, release escrow or
  prove safe unattended storage. Preserve the separate accepted order/payment
  workflow and the customer's authorised handover instructions.

Until that adapter exists, the owner books through the courier's normal service,
records its actual reference, uses the grouped handover actions and contacts the
customer or rider when arrangements change. This remains useful for a small
kitchen without claiming automatic courier coordination.

## Website follow-up — 28 October 2026

The owner confirmed that no approved API account is available yet. Settings →
Courier delivery now makes the manual connection status visible and links to
Planner's collection and delivery runs. Provider onboarding information starts
at https://developer.grab.com/; no undocumented generic webhook has been added.
Customers without a recorded courier reference see that kitchen-entered tracking
will appear when available. Existing tracking links and bulk handover actions
remain functional. Email scheduling is separate from live tracking.

Settings → Collection & delivery now has a direct navigation shortcut and
explains that enabling self-collection requires saving a public location and
collection hours. Basket and checkout then offer it; collection has no delivery
fee, travel buffer or delivery-address requirement. Incomplete locations are not
shown as bookable collection options. Existing orders retain accepted terms.
