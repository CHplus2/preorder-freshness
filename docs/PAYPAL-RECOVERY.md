# PayPal Sandbox payment recovery — batch 3

This batch adds verified completed-capture notifications and an owner-side status
check. Both recover a payment that completed after a browser closed or a response
was lost. They never create a provider order, capture money, change preparation,
deduct stock or mark a delivery complete. Existing Sandbox credentials and the
customer's explicit checkout approval remain in use.

## Owner walkthrough — works with the existing credentials

Open **Orders → Payment records → Check PayPal status** on a PayPal preorder.
The server retrieves that order's saved PayPal reference. A matching completed
capture records one verified receipt; pending or approved payments remain unpaid.
An approved payment still needs the customer's capture flow from My orders.
If no provider payment session exists, the interface explains that the customer
must start it. It cannot create or charge a payment on the customer's behalf.

After a timeout, use the same check again. It is safe to repeat. Last successful
check time and its source (owner or PayPal notification) appear in Payment records.
Temporary provider errors show a retry message; malformed or mismatched evidence
requires review. No payment receipt is accepted from a browser's claimed result.

## Enable automatic notifications on Vercel

The owner check does **not** require a webhook ID. To also recover payments in the
background:

1. Open [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/),
   **Apps & Credentials → Sandbox**, and select the **same app** whose client ID
   and secret are configured in Vercel.
2. Under that app's webhooks, add the URL:
   `https://preorder-freshness.vercel.app/api/payments/paypal/webhook/`.
   Select **Payment capture completed** (`PAYMENT.CAPTURE.COMPLETED`).
3. Copy the resulting **Webhook ID**, not the client ID or a transmission/event ID.
   In Vercel environment variables, set `PAYPAL_SANDBOX_WEBHOOK_ID` to that value
   for Production, then redeploy. Keep the three existing Sandbox settings.
4. Make a new Sandbox checkout, then inspect PayPal's webhook delivery history and
   the website's Payment records. A verified completed payment should produce one
   receipt. Duplicate/resend delivery must not create another receipt.

An ID in Vercel alone does not prove the remote webhook is registered or working.
The URL must reach the Django endpoint without Vercel deployment-protection login.
For a preview/custom domain, register its exact reachable URL on the same Sandbox
app and configure the corresponding ID in that deployment. One app's webhook ID
must not be substituted for another app's ID.

No database migration or additional database variable is needed. Settings remain
private environment configuration, never browser `VITE_` variables or Git files.
Without a configured ID, the notification endpoint returns 503; checkout and the
owner/customer status checks retain their existing behavior.

## Verification and retry behavior

`POST /api/payments/paypal/webhook/` is public to PayPal and uses JSON. A customer
session and CSRF token do not authenticate a notification. Instead:

- Body size and transmission metadata are bounded. The certificate URL must have
  an expected PayPal HTTPS certificate path. The website never downloads that URL
  or follows links contained in the event.
- The server calls Sandbox's fixed
  `/v1/notifications/verify-webhook-signature` endpoint with the configured webhook
  ID, original event and PayPal transmission headers. Only explicit `SUCCESS`
  permits further processing. Headers or a secret-looking URL alone are not proof.
- A completed-capture event identifies a **saved** local provider order. The server
  re-fetches that PayPal order and verifies its local custom/reference IDs, MYR
  amount, final completed capture and the exact notified capture ID. Event fields
  alone cannot mark an order paid. Amount changes are not silently accepted.
- The local order is locked and capture-based unique receipt IDs prevent duplicate
  receipts. The row returned after a concurrent uniqueness conflict is rechecked,
  so one capture cannot pay two local orders.
- Only the latest processed event ID/type/time and check status are retained in
  the existing payment intent. Raw webhook bodies, payer details, transmission
  signatures, access tokens and credentials are not stored in payment records.

Responses: 200 acknowledges a reconciled/ignored event or a permanent mismatch
flagged for review; 400 rejects malformed data; 403 rejects failed signature
verification; 413 rejects an oversized payload; 503 requests a retry after provider
verification/GET failures or when the notified capture is not yet visible as
completed. PayPal may redeliver events. A later unsupported event cannot downgrade
a verified receipt. Unknown/ambiguous local bindings do not pay any order.

Notification requests are throttled to 120/minute per source IP through Django's
configured cache. Owner checks use the existing authenticated 20/minute payment
throttle and session CSRF protection. Use a shared cache/edge limit for global
multi-worker limits. Provider operations use the existing bounded timeout;
temporary outages remain retryable.

`POST /api/admin/orders/{id}/paypal/check/` is staff-only. It accepts no new amount,
provider reference or payment action from the browser. Successful responses use
the existing PayPal status schema. `GET /api/admin/orders/{id}/payments/` adds
`paypal_recovery` with configuration/session presence, state, last successful
check time/source and a safe latest-error code. It is null for other payment types.

## Boundaries and validation

This is **Sandbox only**. Local refund records are preserved. A remote payment
completed after local cancellation is recorded separately; cancellation is not a
refund. Refund/reversal/dispute notifications are not reconciled by this batch.
Handle a test refund in the PayPal Sandbox dashboard and record the verified
outcome in the existing owner ledger. Do not claim automatic refund reconciliation
or deploy this as a live-money integration.

Automated tests exercise signature failure, missing configuration, provider
outages, malformed headers/body, pending/retried captures, exact capture binding,
amount/currency/reference mismatch, duplicate/reordered events, refund/cancellation
preservation, staff permissions/CSRF and a conflicting receipt returned after a
race. Transport tests verify the fixed Sandbox signature-verification endpoint.
Browser checks use isolated SQLite and a local provider double, including a lost
owner-check response and retry, no-session state and 1440/390/320px layouts. These
checks do not establish a live PayPal webhook delivery; verify that after the
Webhook ID is configured on the deployed site.

Validation for this batch: 470 Django tests run, four skipped; frontend regression
suites and production build passed. Receipt and recovery timestamps explicitly use
Malaysia time. No live database records were changed by development checks.

Reference: [PayPal webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/).
