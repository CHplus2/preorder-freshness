# PayPal Sandbox checkout — batch 1

Batch 2 adds [conversational ordering](CONVERSATIONAL-ORDERING.md). Batch 3 adds
[verified capture notifications and owner payment checks](PAYPAL-RECOVERY.md),
including the extra webhook setup needed for background recovery. The original
checkout behavior below still applies.

Dapur Kita supports PayPal **Sandbox only**, in MYR. No live payment host, automatic
refund, chatbot ordering tool or webhook is enabled by this batch. Existing COD,
manual transfers and demo credits keep their current behaviour.

## Enable on Vercel

In PayPal Developer Dashboard, create/select an app under **Sandbox**, then use its
Sandbox **Client ID** and **Secret**. Use a Sandbox business account that supports
MYR (for this Malaysian store, use a Malaysian merchant test account). Create a
separate Sandbox personal/buyer account for approvals; a merchant cannot pay itself.

In Vercel → preorder-freshness → Settings → Environment Variables, add:

| Variable | Value |
| --- | --- |
| `PAYPAL_SANDBOX_ENABLED` | `true` |
| `PAYPAL_SANDBOX_CLIENT_ID` | The Sandbox app's client ID |
| `PAYPAL_SANDBOX_CLIENT_SECRET` | The same Sandbox app's secret |

Choose Production and the Preview environments you intend to use, then redeploy.
Enter secrets through environment settings; never paste them into chat, commit
`.env`, or prefix the secret with `VITE_`. Only the public client ID is returned to
the browser. Set the same variables locally to run the integration locally.
Credentials are not configured by this commit. Without all three settings, PayPal
is hidden at checkout and new PayPal checkouts are rejected. No database migration
is needed: intent state uses `Order.payment_instructions`, and verified receipts use
`PaymentEvent`. Existing schema and records remain compatible with the release gate.

## Customer walkthrough

1. Add menus, choose a delivery time and save the address as usual.
2. When a preparation plan fits, select **PayPal Sandbox**, then **Save preorder &
   continue to PayPal Sandbox**. This creates one unpaid local preorder, snapshots
   its accepted terms and reserves its preparation booking. It clears the basket.
3. Check the recorded MYR total and approve using a Sandbox buyer account in the
   PayPal window. Django creates/captures the payment; a browser callback cannot
   declare it paid.
4. A verified completed capture produces **Payment confirmed**, a visible
   **PayPal Sandbox** label, the no-real-money notice, and one
   `paypal_sandbox` receipt. Cooking status and inventory remain unchanged.
5. If the window closes or the result is unclear, use **My orders → Continue to
   payment** (or **View payment details** for a recorded payment).
   **Check payment status** re-reads the same provider order; it
   never initiates a capture. **Recover payment session** retries an interrupted
   create with its original idempotency key, without charging.

If automatic scheduling needs owner review, checkout creates the existing unpaid
COD review request and does not start PayPal. Confirm the kitchen arrangement
first. Batch 1 does not switch an existing COD request to PayPal automatically.

Unpaid PayPal preorders reserve their saved preparation slots just like other
accepted unpaid preorders. Closing PayPal does not cancel a local order. Ask the
owner to cancel an unwanted booking; automatic expiry/release is not implemented.

## API contract

- `GET /api/payments/paypal/config/`: public `{enabled, sandbox: true,
  currency: "MYR", client_id}`. Disabled configurations return an empty client ID.
- `GET /api/orders/{id}/paypal/`: owning authenticated customer's local payment
  state. No provider call and no mutation.
- `POST /api/orders/{id}/paypal/` with `{"action":"create"}`: create/reuse one
  provider order bound to the saved local total, shipping and discount.
- Same endpoint with `{"action":"capture", "paypal_order_id":"..."}`:
  verify ownership/binding, check provider approval and request capture using a
  durable server-generated request ID. Re-read PayPal before recording payment.
- Same endpoint with `{"action":"refresh"}`: retrieve and reconcile an existing
  provider order; it does not create or capture a payment.

Successful state responses contain `order_id`, `order_status`, `sandbox`, `currency`, `amount`
(decimal string), `payment_status`, `state`, `paypal_order_id`, `capture_id`,
`can_pay`, `reason`, `configured`. Mutations require session authentication/CSRF;
provider operations are limited to 20 requests/minute per customer. Staff cannot
use a customer's identity to pay. Existing owner payment records show the receipt.

A local intent stores stable create/capture request UUIDs **before** any provider
call. Row locks serialize concurrent changes. Retries reuse those IDs and the
same provider order. The provider order ID, custom/local reference, currency,
whole-order amount, final-capture flag and completed status must match. Only then
is a receipt written and the order marked paid. The capture reference yields a
unique receipt request UUID, preventing one capture from paying two local orders.
Provider credentials, access tokens, payer details and raw errors are not stored
in public records or returned to clients. Owner-entered PayPal receipts are refused.

After five hours, no new create/capture POST is made for that intent. This is a
conservative boundary inside PayPal's default request-ID retention window; status
checks can still reconcile a payment that completed. Contact the owner to review
an expired or mismatched payment rather than creating another attempt blindly.

Pending captures stay unpaid. A timeout can mean that PayPal succeeded remotely;
check the same order before retrying. Refunds recorded through the existing owner
ledger do not execute a PayPal refund. No new capture is allowed on refunded or
cancelled orders. A previously completed capture can still be reconciled after a
local cancellation and must be reviewed by the owner for refund handling.

## Verification and remaining work

Automated tests use a provider double and transport mocks to exercise actual
Django endpoints. Browser tests can replace the external SDK and provider only in
an isolated local test fixture; they do not prove PayPal accepted a real Sandbox
transaction. After setting credentials, perform the customer walkthrough with
Sandbox accounts and confirm the capture in the PayPal Sandbox activity dashboard.

Webhook verification and chatbot tools are now documented in the batch guides
above. Automatic refund/reversal reconciliation remains future work. Before accepting real money, use a separate reviewed
production integration; this implementation intentionally cannot target live PayPal.

Reference APIs: [Orders v2](https://developer.paypal.com/docs/api/orders/v2/),
[Standard Checkout](https://developer.paypal.com/docs/checkout/standard/integrate/),
[idempotency](https://developer.paypal.com/api/rest/reference/idempotency/),
[supported currency codes](https://developer.paypal.com/api/rest/reference/currency-codes/).
