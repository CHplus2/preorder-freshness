import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {BrowserProvider, Contract, isAddress, hexlify, randomBytes, formatEther} from 'ethers';
import {escrowActions, escrowFunding, escrowError, waitForEscrowTransaction} from '../../utils/escrowState';
import './CheckoutPage.css';
import './EscrowDemoPage.css';

const abi = [
  'function fund(bytes32 id,address seller,address arbiter,uint256 dispatchBy) payable',
  'function deals(bytes32) view returns(address buyer,address seller,address arbiter,uint256 amount,uint256 dispatchBy,uint256 resolveBy,uint8 state)',
  'function credits(address) view returns(uint256)',
  'function dispatch(bytes32)', 'function confirmReceipt(bytes32)', 'function refund(bytes32)',
  'function dispute(bytes32)', 'function resolve(bytes32,bool)', 'function withdraw()',
];
const states = ['Deal not found', 'Funds held', 'Dispatched', 'In dispute', 'Released to seller', 'Refunded to buyer'];
const instructions = [
  'Check the demo ID and contract address, then refresh.',
  'The seller can mark dispatch or refund the buyer. Funds remain in escrow.',
  'The buyer can confirm receipt to release funds, or either participant can open a dispute before the resolution deadline.',
  'The agreed arbiter can release or refund funds before the resolution deadline.',
  'The seller can withdraw the released coins using their own wallet.',
  'The buyer can withdraw the refunded coins using their own wallet.',
];

export default function EscrowDemoPage() {
  const [contractAddress, setContractAddress] = useState(import.meta.env.VITE_TESTNET_ESCROW_ADDRESS || '');
  const [account, setAccount] = useState('');
  const [dealId, setDealId] = useState('');
  const [deal, setDeal] = useState(null);
  const [seller, setSeller] = useState('');
  const [arbiter, setArbiter] = useState('');
  const [amount, setAmount] = useState('0.001');
  const [credit, setCredit] = useState('0');
  const [chainTime, setChainTime] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
  const operation = useRef(false);
  const version = useRef(0);
  const clearConnection = () => {
    version.current += 1;
    setAccount(''); setDeal(null); setCredit('0'); setChainTime(null);
  };
  useEffect(() => {
    const wallet = window.ethereum;
    const changed = () => {
      clearConnection();
      setError(''); setMessage('Wallet or network changed. Reconnect to refresh your role and balance.');
    };
    wallet?.on?.('accountsChanged', changed);
    wallet?.on?.('chainChanged', changed);
    wallet?.on?.('disconnect', changed);
    return () => {
      version.current += 1;
      wallet?.removeListener?.('accountsChanged', changed);
      wallet?.removeListener?.('chainChanged', changed);
      wallet?.removeListener?.('disconnect', changed);
    };
  }, []);
  const connection = async () => {
    if (!window.ethereum) throw Error('Install or open a compatible Ethereum wallet, then select Sepolia.');
    if (!isAddress(contractAddress)) throw Error('Enter your deployed Sepolia contract address first.');
    const provider = new BrowserProvider(window.ethereum, undefined, {cacheTimeout: -1});
    await provider.send('eth_requestAccounts', []);
    if ((await provider.getNetwork()).chainId !== 11155111n) throw Error('Select Sepolia in your wallet, then reconnect.');
    if (await provider.getCode(contractAddress) === '0x') throw Error('No contract was found at this address on Sepolia.');
    const signer = await provider.getSigner();
    return {contract: new Contract(contractAddress, abi, signer), signer, provider, version: version.current};
  };
  const load = async (context, key) => {
    const {contract, signer, provider} = context;
    if (key && !/^0x[0-9a-fA-F]{64}$/.test(key)) throw Error('Paste the complete demo ID: 0x followed by 64 hexadecimal characters.');
    const [balance, result, block] = await Promise.all([
      contract.credits(signer.address), key ? contract.deals(key) : null, provider.getBlock('latest'),
    ]);
    if (context.version !== version.current) return;
    setAccount(signer.address); setCredit(formatEther(balance)); setDeal(result); setChainTime(block.timestamp);
  };
  const perform = async action => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(''); setMessage('Check your wallet to continue.');
    let context;
    try { context = await connection(); await action(context); }
    catch (cause) { if (!context || context.version === version.current) { setError(escrowError(cause)); setMessage(''); } }
    finally { operation.current = false; setBusy(false); }
  };
  const transact = async (context, method, args = [], key = dealId, options = {}) => {
    const tx = await context.contract[method](...args, options);
    setMessage('Transaction submitted. Waiting for Sepolia confirmation…');
    await waitForEscrowTransaction(tx, setTxHash);
    if (context.version !== version.current) {
      setMessage('Transaction confirmed. Reconnect the active wallet to refresh this deal.'); return;
    }
    try {
      await load(context, key);
      if (context.version === version.current) setMessage('Transaction confirmed. Deal and withdrawal balance refreshed.');
    } catch {
      setMessage('Transaction confirmed. Refresh the deal to load its latest status; do not repeat the transaction.');
    }
  };
  const actions = escrowActions(deal, account, chainTime);
  const state = Number(deal?.state ?? 0);
  const action = (method, args = [dealId]) => perform(context => transact(context, method, args));
  const copyId = async () => {
    try { await navigator.clipboard.writeText(dealId); setCopied(true); }
    catch { setError('Could not copy automatically. Select the demo ID and copy it manually.'); }
  };
  return <main className="checkout-container escrow-demo">
    <Link to="/checkout" className="checkout-back">← Back to checkout</Link>
    <header className="escrow-header"><p className="escrow-badge">Sepolia · test coins only</p><h1 className="checkout-title">Testnet escrow</h1>
      <p className="checkout-intro">Lock test coins until receipt confirmation or a refund. This lab is separate from food orders and does not mark an order paid.</p></header>
    <ol className="escrow-steps"><li>Buyer locks coins</li><li>Seller marks dispatch</li><li>Buyer confirms receipt</li><li>Seller withdraws</li></ol>
    {error && <p className="checkout-error" role="alert">{error}</p>}
    {message && <p className="escrow-status" role="status">{message}</p>}
    {txHash && <p><a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View latest submitted transaction ↗</a></p>}
    <div className="checkout-grid"><div className="checkout-main">
      <section className="checkout-section"><h2>1. Connect a test wallet</h2>
        <fieldset disabled={busy}><label>Sepolia contract address<input autoComplete="off" spellCheck={false} placeholder="0x…" value={contractAddress} onChange={event => {
          setContractAddress(event.target.value.trim()); clearConnection(); setError(''); setMessage(''); setTxHash('');
        }}/></label><button className="checkout-submit" onClick={() => perform(async context => {await load(context, dealId); if (context.version === version.current) setMessage('Connected to Sepolia.');})}>{account ? 'Reconnect wallet' : 'Connect wallet'}</button></fieldset>
        {account && <p className="escrow-address"><strong>Connected wallet</strong><br/>{account}{deal && state > 0 && <><br/>Role: {actions.role}</>}</p>}
        <p className="checkout-hint">Switch between buyer, seller and arbiter in your wallet extension. Reconnect after switching.</p>
      </section>
      <section className="checkout-section"><h2>2. Lock coins as the buyer</h2>
        <form onSubmit={event => {
          event.preventDefault();
          perform(async context => {
            const value = escrowFunding(seller, arbiter, context.signer.address, amount);
            const block = await context.provider.getBlock('latest');
            const key = hexlify(randomBytes(32));
            setDealId(key); setDeal(null); setCopied(false);
            await transact(context, 'fund', [key, seller, arbiter, block.timestamp + 3600], key, {value});
          });
        }}><fieldset disabled={busy}>
          <label>Seller wallet<input required autoComplete="off" spellCheck={false} placeholder="0x…" value={seller} onChange={event => setSeller(event.target.value.trim())}/></label>
          <label>Arbiter wallet<input required autoComplete="off" spellCheck={false} placeholder="0x…" value={arbiter} onChange={event => setArbiter(event.target.value.trim())}/></label>
          <label>Amount in test ETH<input required type="number" min="0.000001" max="0.01" step="0.000001" value={amount} onChange={event => setAmount(event.target.value)}/></label>
          <p className="checkout-hint">Use three distinct wallets. Dispatch is due one hour after the latest chain timestamp. Your wallet displays gas fees before approval.</p>
          <button className="checkout-submit" disabled={!account}>Lock test coins</button>
        </fieldset></form>
      </section>
    </div><aside className="checkout-section"><h2>3. Review and manage a deal</h2>
      <fieldset disabled={busy}><label>Demo ID<input autoComplete="off" spellCheck={false} placeholder="0x…" value={dealId} onChange={event => {setDealId(event.target.value.trim()); setDeal(null); setCopied(false);}}/></label>
        <div className="checkout-actions"><button disabled={!dealId} onClick={() => {
          if (!/^0x[0-9a-fA-F]{64}$/.test(dealId)) {setError('Paste the complete demo ID: 0x followed by 64 hexadecimal characters.'); return;}
          perform(async context => {await load(context, dealId); if (context.version === version.current) setMessage('Deal and withdrawal balance refreshed.');});
        }}>Refresh deal</button><button disabled={!/^0x[0-9a-fA-F]{64}$/.test(dealId)} onClick={copyId}>{copied ? 'Copied' : 'Copy ID'}</button></div></fieldset>
      <p className="checkout-hint">Save this ID and share it with the seller and arbiter. It is needed to find the deal again.</p>
      {deal && <div className="escrow-deal"><h3>{states[state]}</h3><p>{instructions[state]}</p>
        {state > 0 && <><p><strong>{formatEther(deal.amount)} test ETH</strong> · Your role: {actions.role}</p>
          <details><summary>Participants and deadlines</summary><p className="escrow-address">Buyer: {deal.buyer}<br/>Seller: {deal.seller}<br/>Arbiter: {deal.arbiter}</p>
            <p>Dispatch by: {new Date(Number(deal.dispatchBy) * 1000).toLocaleString()}<br/>Resolve by: {new Date(Number(deal.resolveBy) * 1000).toLocaleString()}</p></details>
          <div className="checkout-actions">
            {actions.dispatch && <button disabled={busy} onClick={() => action('dispatch')}>Mark dispatched</button>}
            {actions.confirm && <button disabled={busy} onClick={() => action('confirmReceipt')}>Confirm receipt & release</button>}
            {actions.dispute && <button disabled={busy} onClick={() => action('dispute')}>Open dispute</button>}
            {actions.refund && <button disabled={busy} onClick={() => action('refund')}>{actions.role === 'Seller' ? 'Refund buyer' : 'Claim refund'}</button>}
            {actions.resolve && <><button disabled={busy} onClick={() => action('resolve', [dealId, true])}>Refund buyer</button><button disabled={busy} onClick={() => action('resolve', [dealId, false])}>Release to seller</button></>}
          </div>
          {![actions.dispatch, actions.confirm, actions.dispute, actions.refund, actions.resolve].some(Boolean) && [1,2,3].includes(state) && <p className="checkout-hint">No action is currently available for this wallet. Refresh after a deadline or switch to the required participant.</p>}
        </>}
      </div>}
      <div className="escrow-withdrawal"><h3>Your withdrawal balance</h3><p><strong>{credit} test ETH</strong></p>
        <button disabled={busy || !account || Number(credit) <= 0} onClick={() => action('withdraw', [])}>Withdraw coins</button>
        <p className="checkout-hint">Released or refunded coins become withdrawal credit. The recipient must withdraw separately.</p></div>
    </aside></div>
    <details className="escrow-limits"><summary>Setup, refunds and limits</summary>
      <p>Deploy <code>escrow/PreorderEscrow.sol</code> on Sepolia using the repository’s escrow README. No contract is deployed automatically. Only use an address deployed from this source.</p>
      <p>The seller may refund any unsettled deal. The buyer may refund after missed dispatch, or after the resolution deadline (seven days after dispatch was due). Until that resolution deadline, either participant may dispute a dispatched deal and the arbiter may decide its outcome.</p>
      <p>This unaudited prototype cannot verify physical delivery. A buyer may reclaim an unresolved deal after the deadline, even if delivery occurred. Never use real funds or put customer information on-chain.</p>
    </details>
  </main>;
}
