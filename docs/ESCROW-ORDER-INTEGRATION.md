# Order-bound Sepolia escrow — 23 October 2026

Escrow is now an optional checkout payment method (`payment_method=escrow`).
It is enabled only when the backend configuration below is complete. The older
`/escrow-demo` remains a standalone wallet tool and cannot pay a food order.
The order-bound flow is `/payment/escrow?order=<id>`.

## Batch 1 — durable invoices and independent verification

Checkout saves the actual order and leaves it unpaid. A delivery request needing
planning review is still saved as COD/unpaid with no advance-payment prompt.
Only the customer can create its escrow invoice, binding the funding wallet.
The invoice lives in existing `Order.payment_instructions`, so no database
migration or fictional order-history rewrite is needed. It fixes a random
on-chain reference, chain, contract, participants, recorded MYR total, exact
wei quote, dispatch deadline and minimum confirmations. Those values come from
the server. Customer details and real order numbers are not written on-chain.

The server independently reads JSON-RPC, checking Sepolia's chain ID, canonical
funding receipt/block, confirmations, sender/recipient, exact value and calldata,
expected funding event, runtime code hash and confirmed escrow struct. Only then
is an idempotent `PaymentEvent` receipt created with `source=escrow_sepolia` and
the order marked paid. An observed on-chain refund produces one refund event
and a refunded payment status. Release/refund credit and actual withdrawal are
separate. Manual owner receipt/refund shortcuts are blocked for escrow orders.
No blockchain transaction, private key, fulfillment update or inventory deduction
is performed by the server.

A submitted hash is saved before RPC verification so a provider failure can be
recovered later. Pending/insufficient-confirmation evidence leaves the order
unpaid. The same funding transaction cannot create two receipts or pay two
orders. Invoice-bound delivery changes are blocked because the contract's
funding deadline is fixed. Resolve the escrow and contact the kitchen to close/replace the booking for a
different delivery arrangement; an invoice is never silently replaced.

## Batch 2 — checkout, customer and owner screens

The configured checkout method leads to the saved order's escrow screen. The
customer connects a wallet, receives a fixed quote, and funds the assigned
reference. Contract, payees, reference and amount are read-only in this flow.
Transaction submission saves its hash for recovery; confirmed funding triggers server verification; the page rechecks up to fifteen
times at eight-second intervals while open, then retains a manual status check.
A saved browser reference is automatically recovered after reload; an optional transaction-hash check handles a lost submission callback. My orders links back to the same payment. Owner Orders and Payment records link
to it, with independently verified receipt/refund entries. Staff may inspect
and verify a customer's payment, but cannot assign the buyer wallet.

Escrow status does not automatically mark food prepared, dispatched or delivered.
The wallet controls contract actions; the existing order/planner workflow still
records actual kitchen and delivery progress.

## Batch 3 — operational checks and recovery

Set these **server-side Vercel environment variables**, then redeploy:

| Variable | Value |
| --- | --- |
| `ESCROW_SEPOLIA_ENABLED` | `true` |
| `ESCROW_RPC_URL` | Trusted HTTPS Sepolia JSON-RPC URL supporting batch requests and historical code reads; provider credentials stay server-side |
| `ESCROW_CONTRACT_ADDRESS` | Address deployed from the pinned `escrow/PreorderEscrow.sol` version |
| `ESCROW_SELLER_ADDRESS` | Kitchen's Sepolia wallet address |
| `ESCROW_ARBITER_ADDRESS` | Separate agreed arbiter address |
| `ESCROW_WEI_PER_MYR` | Positive whole-number test wei per recorded MYR; for example `1000000000000` |
| `ESCROW_MIN_CONFIRMATIONS` | `3` by default; permitted range 2–64 |

The quote is a configured **test scenario**, not a market exchange rate. The
contract caps each deposit at 0.01 ETH, and funding must be within seven days of
dispatch. Far-future preorders remain saved and unpaid until their funding window.
The three participant wallets must be distinct. Never supply private keys or
seed phrases to this application. `VITE_TESTNET_ESCROW_ADDRESS` alone enables
only the standalone screen; it does not configure backend order verification.

For local use, first update the activated virtual environment with
`python -m pip install -r backend/requirements.txt`. Vercel installs the updated
`pyproject.toml` dependencies during deployment.

Run the read-only deployment check in the configured backend environment:

```sh
python backend/manage.py check_escrow_configuration
```

Recover submitted payments after a customer closes the page or an RPC outage:

```sh
python backend/manage.py reconcile_escrow_orders --limit 20
python backend/manage.py reconcile_escrow_orders --order-id 148
```

Schedule that bounded command with the deployment's job runner if unattended
reconciliation is required. No background scheduler has been enabled by this
change. The command reads the blockchain and updates only verified ledger rows;
it never sends funds or customer messages. Manual status checks remain available.

## Endpoints

- `GET /api/payments/escrow/config/`: public availability, fixed chain ID and
  public contract address; never the RPC URL or credentials.
- `GET /api/orders/<id>/escrow/`: own order or staff; invoice and recorded status.
- `POST /api/orders/<id>/escrow/`: session/CSRF protected, 20 requests/minute.
  `create` takes `buyer`; `verify` takes `transaction_hash`; `refresh` uses the
  saved hash. No amount, participant or provider URL override is accepted.

## Verification and remaining limits

Local tests cover confirmed/pending/rejected evidence, invalid parties and
amounts, wrong chains/code/events/blocks, retries, ownership/CSRF, manual bypass,
RPC failure, fixed invoice terms, and regression coverage for PayPal/planning.
A Chromium checkout journey uses Django and an actual in-memory EVM together:
record escrow on the order, fund it, independently verify the receipt, show paid
in My orders, refund on-chain, and show exactly one receipt plus one refund in
the owner's ledger. Desktop/mobile accessibility checks cover those screens.

Public Sepolia deployment, Vercel environment configuration and an actual wallet
extension are not verified here. A background scheduler is optional setup, not
an already-running service. Confirmations reduce reorg exposure but do not
provide an absolute finality guarantee; a later contradictory observation needs
owner review and does not silently erase prior payment records. The underlying
prototype's buyer timeout and arbitration limitations remain; this is not a
mainnet production-payment approval. See [contract review](ESCROW-PAYMENT-REVIEW.md).

Local verification: 14 focused escrow-order tests, the related 125-test backend
regression run, seven operations-security tests, six contract tests, frontend
escrow/checkout/UX checks, five Vercel packaging/entrypoint tests and production
build passed. Eight responsive browser scans reported no WCAG A/AA violations
or horizontal overflow in the tested states. The browser journey also verifies
that switching order IDs clears the previous invoice before loading another.
