# Client order follow-up — batch 1

This batch implements the client's 8 November changes to My orders and daily printing. Application work stays on `main`. Report/media drafts remain unpublished; the next requested batch is the two demo voices and matching presentation slides. The report will wait for the author's reuploaded paper.

## Customer cancellation and contact

A customer's own pending simple-workflow order has a Cancel order button and confirmation dialog. The server checks ownership and the saved order version, then records cancellation once. Received, cooked or shipped orders cannot be cancelled through this customer action. Earlier scheduling/forecast history is excluded. A stale version requires a refresh; retries of an already-cancelled own order return its saved state without duplicate amendments.

Cancellation preserves accepted names/prices, payment evidence and payment status. It does not issue a refund or assume ingredients/packaging are unused. The owner can explicitly confirm Return unused stock on a cancelled order; this restores its original recorded batches/packaging once and retains the cancellation/payment record.

WhatsApp uses the current kitchen number in Settings, not a hardcoded business short link. The prepared message includes the order reference, date, accepted item names/quantities and cancellation reason when entered. It opens only after the server confirms cancellation. The customer still reviews and presses Send in WhatsApp. A persistent follow-up link is available if the browser blocks the automatic handoff. Ask the kitchen on WhatsApp opens an order-specific enquiry directly; missing/invalid contact configuration falls back to the contact page, where other saved channels are available.

## Date guidance and layout

The time-change policy remains future agreed time plus an unreceived/uncancelled order. The date restriction follows the earliest recorded deadline among the actual reserved ingredient lots, including any earlier updated batch date. It is not a fixed seven-day limit. Held/expired reserved stock requires kitchen review. New stock elsewhere in inventory does not silently replace an order's existing allocation.

The form displays this latest reserved-stock date before saving, bounds the native date/time picker and retains the server check. Dedicated component styles now apply in both customer and owner views. Reason/save controls, load/retry states and order-view filters have explicit spacing.

## Print the daily set once

The daily summary has a primary Print all orders in this view action. It preserves the selected Malaysia date and receipt filter and loads every matching order, independently of the summary's 50-row pagination. Cancelled/generated rows remain excluded. All accepted item prices, contact/address or collection information are included. One explicit Print / Save PDF action prints the set, starting each order on a new page. Individual printing remains available in the order queue.

The staff-only endpoint returns private, non-cacheable data. An oversized run fails explicitly rather than presenting a partial set as complete. The print action is disabled while loading, after errors or for an empty set. The Sales & costs Daily order summary link uses the normal action-link treatment without an underline.

## Validation and scope

- Focused backend checks cover cancellation ownership/CSRF, stale/repeated requests, payment and stock preservation, owner-confirmed return, recorded date limits and all-page printing/receipt filters.
- The complete backend run passed with 76 environment-dependent skips; skipped checks are not passes. Schema checking found no migration changes. The runtime suite and relevant frontend suites, lint and build passed.
- Chromium verified cancellation, an intercepted order-specific WhatsApp draft, cancelled history, unchanged paid/stock records, owner-confirmed stock return, desktop/mobile form spacing and no phone-width overflow. A single print action produced a two-order, two-page PDF, and the Daily order summary link had no underline. Checks used temporary SQLite; no message, bank transfer, production order or actual printer job was sent.

Forecasting/model files and the integration branch are preserved. Published reports, menu photos and existing downloads are unchanged in this application batch. A GitHub push is not confirmation that a live Vercel deployment has completed.
