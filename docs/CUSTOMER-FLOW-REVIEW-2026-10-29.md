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

## Batches 2–4: menu, basket, checkout and Settings review

Source review found that the catalogue already loads 12 rows per page with a
250ms first-page search debounce, cancellation/generation checks, responsive
photo assets and bounded rendering. Menu recommendation results remain separate
from the date-based finder. Basket quantities and prices are server-validated;
mutations are serialized and stale/read-failure states hide submission actions.
Checkout uses a single time selection, authoritative quote/price checks,
per-account request identities and retained same-order payment recovery. These
flows were preserved, rather than adding speculative changes to working pages.

Settings had two concrete recovery issues. Text inputs, textareas and the manual
payment toggle stayed editable during a save; the eventual response could replace
those newer edits. They are now disabled together with fulfilment controls until
the operation finishes. A failed save previously offered Reload settings, which
could discard the retained draft. A failed save now explains that edits remain
and lets the owner save again. Initial loading failures still offer a read retry.
Staff/session/CSRF checks on the actual PATCH endpoint remain authoritative;
this interface change grants no permissions and reveals no credentials.

My orders still fetched a customer's complete history even though only ten cards
were initially displayed. Server-side paging is the final review batch.

Batches 2–4 validation: frontend lint, UX tests and build pass. Nineteen local
Chromium WCAG A/AA and page-overflow checks cover menu, basket, checkout and
Settings at 1440/768/390/320 pixels, plus an empty escaped search, failed basket
read and failed settings save. A deliberately delayed save disables every form
control; a simulated server failure keeps the draft, and a retry saves it to the
isolated fixture. A customer is denied the owner reminder API. No payment, email,
courier or production data operation was performed. These checks cover the
reviewed states, not every possible input or production load.
