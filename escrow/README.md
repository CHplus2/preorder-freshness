# Sepolia escrow demonstration

This is an **unaudited academic prototype using valueless test ETH**, separate from real food orders and MYR payments. Neither the backend nor a successful test transaction marks a customer order paid. No contract has been deployed by this repository.

## Run the contract tests

From `escrow`, run `npm ci`, `npm test`, then `npm run compile`. Tests execute on an in-process Hardhat EDR chain with chain ID 31337; they never transfer real money. Compiler output is written to ignored `artifacts/`.

Tests create a fresh simulated network for each case; no HTTP RPC server or remote
chain is used. Node.js 24 is used in CI. The mainnet-refusal case uses a separate
local chain configured with ID 1; it does not connect to Ethereum mainnet.
Negative transaction tests wait for the mined receipt as well as checking
submission. The provider disables RPC caching so newly mined state and advanced
deadlines are observed immediately. Solidity remains pinned to 0.8.30 with
Shanghai/200 optimizer runs; the compiler's temporary-file dependency is patched
without changing that compiler or the contract. Native EDR binaries are supplied
through npm's platform-specific optional dependencies, including for CI.

The application CI installs both the Django requirements and the existing pinned ML lock, since the held-out backtest tests import NumPy and pandas. Escrow runs in a separate CI job so an unrelated application failure does not prevent contract checks from running.

## Demonstrate with wallets

1. Use three different test wallets as buyer, seller and arbiter. Select **Sepolia** and obtain valueless Sepolia test ETH for gas. Never use a mainnet account holding funds for the demonstration.
2. Open the official [Remix IDE](https://remix.ethereum.org/), create `PreorderEscrow.sol`, and paste this repository's contract. Compile with Solidity **0.8.30**, EVM **Shanghai**, optimiser enabled, 200 runs.
3. In Deploy & Run, select the injected wallet provider, verify Sepolia (11155111), and deploy `PreorderEscrow`. The contract constructor rejects chains other than Sepolia or local 31337.
4. Open `/escrow-demo` in this app. Paste the deployed contract address and connect the buyer wallet. Alternatively set the public `VITE_TESTNET_ESCROW_ADDRESS` at frontend build time.
5. Enter seller and arbiter addresses and choose **Fund escrow** for up to 0.01 test ETH. Save the randomly generated escrow reference and share it with the other test participants. No real order number, contact information, or delivery address belongs on-chain.
6. Switch to seller, refresh the escrow, and mark dispatch. Switch to buyer, refresh, and confirm receipt. Switch back to seller, refresh, and withdraw the released coins.
7. For the dispute scenario, create another deal, dispatch it, and open a dispute as buyer or seller. The arbiter can refund the buyer or release to the seller. The recipient then withdraws.

Each action requires the user's wallet confirmation. The page checks network, active signer and the exact deployed runtime-bytecode hash on every operation. `frontend/src/contracts/preorderEscrow.json` pins the ABI, Solidity compiler, source SHA-256 and runtime Keccak-256. `compile.mjs` and contract tests fail if this manifest differs from the source. After reviewing an intentional source/compiler change, regenerate it with `node compile.mjs --sync-client`, then deploy the matching contract. Existing mismatched deployments are rejected; this is source/version matching, not an independent security audit.

The page displays the connected wallet's role and offers actions using the last refreshed chain timestamp. Refresh after deadlines or other participants' transactions. Funding deadlines use chain time rather than your laptop clock. Wallet/network changes clear stale participant state, pending operations disable duplicate submissions, and the transaction link remains available if the post-confirmation refresh fails. A successful replacement transaction (wallet speed-up) uses its final receipt and hash; cancellation does not appear as successful settlement.

## Exact rules and limitations

- The web escrow gives the seller one hour to dispatch; the contract allows deadlines up to seven days from funding.
- The seller can refund before settlement, including during a dispute.
- A buyer can reclaim an undispatched deal after its dispatch deadline.
- Either buyer or seller may dispute a dispatched deal until seven days after the dispatch deadline. Only the selected arbiter can decide the outcome of an active dispute during that period.
- After that resolution deadline the buyer can reclaim any unsettled deal, even if dispatched. This deliberately avoids indefinitely locked demo coins but **does not protect a seller against a dishonest buyer or absent arbiter**.
- Buyer receipt confirmation releases funds; seller dispatch alone does not. Settlement creates withdrawal credit, using checks/effects before external calls, and the recipient withdraws separately.
- Physical delivery is an external fact. This contract cannot verify food quality, GPS arrival, or delivery. No claim of guaranteed fair physical exchange is made.
- Gas is charged by the test network even for some failed transactions. The app never converts MYR into ETH.
- Live deployment would require an independent security review, an agreed arbitration and evidence process, settlement/payment compliance review, robust backend receipt verification, and a full production payment design.

References: [Ethereum smart contracts and real-world limitations](https://ethereum.org/developers/docs/smart-contracts/), [Solidity security considerations](https://docs.soliditylang.org/en/latest/security-considerations.html), [ethers wallet interaction](https://docs.ethers.org/v6/getting-started/).


## Browser recovery and presentation (reviewed 23 October 2026)

The heading is **Escrow payment**; the page retains one Sepolia test-network
badge and a short disclosure that test ETH has no monetary value and does not
pay for a food order. Buttons use normal action names (Fund escrow, Confirm
receipt & release, Withdraw funds). Release/refund means withdrawal credit,
not that the recipient has already withdrawn it. Times are shown in Malaysia
time. The existing `/escrow-demo` URL remains compatible with saved links.

Up to ten public contract addresses, escrow references and transaction hashes
are retained in browser storage, when available. Private keys, seed phrases and
customer details are never requested or saved. A saved reference is not proof
of payment; the page reads the verified contract for current state. Unknown
confirmations block new writes until a receipt is checked. Reloading restores
the pending reference; connect/refresh recovers its status. Wallet speed-ups
use the replacement hash; cancellations/reverting receipts are not success.
A missing confirmation never marks a food order paid.

Local review covers six contract tests, including wrong-contract rejection,
reverting recipient transfers and attempted reentrant withdrawal. Chromium
journeys connect buyer/seller/arbiter to an in-memory EVM using the Sepolia
chain ID, without remote RPCs, real funds or an actual wallet extension.
Funding, dispatch, release/withdrawal, arbitration/refund, deadline refund,
reload recovery and wrong-network/code rejection passed. This does not verify
a public Sepolia deployment, a deployed Vercel environment, or production
payment settlement. See [escrow review](../docs/ESCROW-PAYMENT-REVIEW.md).
