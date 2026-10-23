# Escrow payment review — 23 October 2026

The escrow contract supports a working test-chain lifecycle, with wallet-signed
funding, dispatch, receipt confirmation, dispute, refund and separate withdrawal.
It remains separate from store checkout. No backend endpoint binds a deal to an
order or verifies a blockchain receipt to update payment status. The database
credit wallet is a different system using fictional MYR credits.

## Findings and changes

| Finding | Result |
| --- | --- |
| Any deployed bytecode was accepted as an escrow | Pin the ABI and exact runtime code hash produced by Solidity 0.8.30, Shanghai, optimizer 200. Reject empty or different bytecode before any write. Compilation/tests check that the public manifest matches current source. |
| A missing transaction confirmation could be retried as another payment | Retain the submitted hash/reference, block new writes while its result is unknown, and query the receipt on connect/refresh. Successful replacement transactions retain the final hash. Failed/cancelled transactions do not claim success. |
| References were lost on page reload | Retain at most ten validated public references/hashes in browser storage and restore pending confirmation checks. Storage failures leave copyable references/transaction links available. No private keys or customer details are stored. |
| Wallet/network changes during a connection could leave stale context | Bind reads to a connection version and recheck chain/account immediately before submitting a transaction. Clear displayed role/balance on wallet events. |
| Release/refund wording implied payout had already reached the wallet | Show Ready for seller/buyer withdrawal, with the separate withdrawal balance and action. |
| Repeated laboratory wording obscured the normal flow | Use Escrow payment and normal actions; retain a short explicit Sepolia test-network/no-value/no-order-settlement disclosure. Keep contractual limitations available below. |
| follow-redirects security advisories appeared in both workspaces | Update the compatible transitive patch in both lockfiles; retain compiler/contract semantics. |

The Solidity contract was not changed. Constructor chain restrictions, the
0.01 ETH ceiling, role checks, deadline rules, pull withdrawals and reentrancy
guard remain in force. A failed recipient transfer leaves its credit intact.

## What was verified

- Six local contract tests: lifecycle/permissions/deadlines, mainnet refusal,
  invalid funding, exactly-once recipient credits, supported bytecode identity,
  failed withdrawal rollback and reentrancy resistance.
- Frontend state/recovery tests: role boundaries, valid amounts, replaced/cancelled
  transactions, missing receipts, bounded public browser references, unavailable
  storage and explicit presentation boundaries.
- Chromium with the real compiled contract on an in-memory EVM: funding → seller
  dispatch → buyer release → actual withdrawal; dispute → arbiter refund → buyer
  withdrawal; deadline refund; reference restoration; uncertain confirmation
  restoration; mainnet/different-code rejection before transactions.
- Nine responsive WCAG A/AA automated scans at desktop/tablet/phone widths found
  no violations or horizontal overflow in the tested states. These checks do
  not replace manual accessibility or external wallet-extension testing.

## Limits and recommendation

Use Sepolia for the showcase. This is not ready to receive real customer money:

- Buyer timeout refunds remain possible after dispatch or actual delivery if the
  buyer does not confirm and arbitration is not completed by the deadline.
- The chosen arbiter is an address agreed at funding; no independent arbitration,
  evidence process or physical delivery verification is supplied by this code.
- A payout may fail for a contract recipient that cannot receive ETH; credit is
  preserved, but no alternate payout-address feature exists.
- Actual Sepolia deployment/address configuration, wallet-extension behavior,
  public-chain reorg handling and Vercel production configuration were not
  verified in this environment.
- Store integration would need a server-issued order/amount/participant binding,
  server-side receipt/event verification, replay protection, confirmation/reorg
  handling and fulfillment/refund synchronization before marking an order paid.

Mainnet would require a separate reviewed settlement design and independent
contract security audit; changing the network ID or hiding test labels is not a
production launch. No public-chain contract deployment or real-fund transaction was performed.
No forecasting model, order, payment or inventory database record was changed.
