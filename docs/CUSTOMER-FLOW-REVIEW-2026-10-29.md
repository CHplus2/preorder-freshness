# Customer flow review — 29 October 2026

This review follows the completed October UI batches and the separate sample
storage correction. It covers the new payment request and the menu, basket,
checkout, Settings and My orders. It uses the supplied food-app references for
hierarchy, compact information, touch targets and a clear next action. It does
not establish measured conversion improvements or guarantee live services.

## Batch 1: payment choices

- PayPal's primary customer label is PayPal. Its note explicitly says test payment
  and no real money; the integration still uses Sandbox only. Capture audit
  provenance and test buyer instructions remain truthful.
- New courier delivery checkout refuses cash both in the UI and server, including
  legacy express method submissions. Cash at collection remains available.
  No payment is preselected. Switching pickup back to delivery cannot submit the
  hidden cash selection. Configured transfer, PayPal and escrow choices retain
  their verification boundaries; demo credits remain separately disclosed.
- Review requests previously defaulted to COD. They now save deferred/unpaid,
  without debit, provider session or advance transfer instructions. Once the
  kitchen confirms preparation, My orders can select payment once and resume
  the established payment flow without creating another order.
- The new selection endpoint requires order ownership and session CSRF, checks
  method availability and confirmation again under an order lock, snapshots
  transfer instructions, and uses a durable UUID for ambiguous retries. It never
  changes amounts, marks paid or directly calls providers. Choices load only on
  customer request, not once for every historical order. Prior COD records remain.
- Unrelated checkout fixtures now use configured manual transfer instead of COD,
  preserving their original scheduling, rollback, pricing, consent and address
  assertions. Pickup fixtures continue to exercise cash.

Local browser checks cover 1440, 768, 390 and 320 pixels: delivery has no cash
radio or default payment, pickup permits cash, switching back guards the hidden
selection, unconfirmed requests expose no payment action, and a confirmed
request chooses manual payment then displays its saved instructions. Ten WCAG
A/AA and page-overflow checks pass. No production order, payment or email was
created. Backend/provider checks use isolated SQLite and mocked PayPal. No
migration, live credentials or production data change is needed.

## Review sequence

2. Menu and basket: browsing, recommendation states, quantities, API permissions,
   price authority and request/response costs.
3. Checkout: fulfilment/address/time/payment, failure recovery, duplicate-submit
   and session boundaries, plus phone layout and keyboard navigation.
4. Settings: saved versus edited values, error recovery, staff/CSRF boundaries,
   exposed business information and reminder/setup request costs.
5. My orders: current/history actions, payment follow-up, permissions and large
   histories; finish with targeted shared regression checks.

The live Supabase RLS setting has not been observed. The user's reported 79
updated location records is not evidence about RLS; it remains separate from
these source-code and isolated-environment checks.

Batch 1 validation: the full Django suite ran 822 tests, with 25 backend-specific
or optional checks skipped on SQLite. The initial run found two checkout fixtures
that still lacked configured manual transfer; those fixtures were corrected and
the full suite then passed. Frontend lint, UX, checkout, PayPal and shopping suites
and production build pass. A provider-double round trip selects PayPal after
confirmation, verifies capture, writes one receipt and safely replays selection.
Additional browser failure injection loses a successful selection response, then
retries the same UUID; leaving My orders before a delayed selection response
cannot navigate the customer away from their new page. This is not a live-provider
or PostgreSQL-concurrency test. The existing bundle-size advisory remains.
