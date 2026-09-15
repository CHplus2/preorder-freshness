# Sepolia escrow demonstration

This is an **unaudited academic prototype using valueless test ETH**, separate from real food orders and MYR payments. Neither the backend nor a successful test transaction marks a customer order paid. No contract has been deployed by this repository.

## Run the contract tests

From `escrow`, run `npm ci`, `npm test`, then `npm run compile`. Tests execute on an in-memory Ganache chain with chain ID 31337; they never transfer real money. Compiler output is written to ignored `artifacts/`.

## Demonstrate with wallets

1. Use three different test wallets as buyer, seller and arbiter. Select **Sepolia** and obtain valueless Sepolia test ETH for gas. Never use a mainnet account holding funds for the demonstration.
2. Open the official [Remix IDE](https://remix.ethereum.org/), create `PreorderEscrow.sol`, and paste this repository's contract. Compile with Solidity **0.8.30**, EVM **Shanghai**, optimiser enabled, 200 runs.
3. In Deploy & Run, select the injected wallet provider, verify Sepolia (11155111), and deploy `PreorderEscrow`. The contract constructor rejects chains other than Sepolia or local 31337.
4. Open `/escrow-demo` in this app. Paste the deployed contract address and connect the buyer wallet. Alternatively set the public `VITE_TESTNET_ESCROW_ADDRESS` at frontend build time.
5. Enter seller and arbiter addresses and lock up to 0.01 test ETH. Save the randomly generated demo ID and share it with the other test participants. No real order number, contact information, or delivery address belongs on-chain.
6. Switch to seller, refresh the demo, and mark dispatch. Switch to buyer, refresh, and confirm receipt. Switch back to seller, refresh, and withdraw the released coins.
7. For the dispute scenario, create another deal, dispatch it, and open a dispute as buyer or seller. The arbiter can refund the buyer or release to the seller. The recipient then withdraws.

Each action requires the user's wallet confirmation. The page checks network, active signer and deployed bytecode on every operation. Only use the address of the contract you deployed from this source; bytecode existence alone does not authenticate a contract's source.

## Exact rules and limitations

- The web demo gives the seller one hour to dispatch; the contract allows deadlines up to seven days from funding.
- The seller can refund before settlement, including during a dispute.
- A buyer can reclaim an undispatched deal after its dispatch deadline.
- Either buyer or seller may dispute a dispatched deal until seven days after the dispatch deadline. Only the selected arbiter can decide the outcome of an active dispute during that period.
- After that resolution deadline the buyer can reclaim any unsettled deal, even if dispatched. This deliberately avoids indefinitely locked demo coins but **does not protect a seller against a dishonest buyer or absent arbiter**.
- Buyer receipt confirmation releases funds; seller dispatch alone does not. Settlement creates withdrawal credit, using checks/effects before external calls, and the recipient withdraws separately.
- Physical delivery is an external fact. This contract cannot verify food quality, GPS arrival, or delivery. No claim of guaranteed fair physical exchange is made.
- Gas is charged by the test network even for some failed transactions. The app never converts MYR into ETH.
- Live deployment would require an independent security review, an agreed arbitration and evidence process, settlement/payment compliance review, robust backend receipt verification, and a full production payment design.

References: [Ethereum smart contracts and real-world limitations](https://ethereum.org/developers/docs/smart-contracts/), [Solidity security considerations](https://docs.soliditylang.org/en/latest/security-considerations.html), [ethers wallet interaction](https://docs.ethers.org/v6/getting-started/).
