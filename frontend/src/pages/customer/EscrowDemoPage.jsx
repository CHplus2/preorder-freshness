import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {BrowserProvider, Contract, isAddress, hexlify, randomBytes, formatEther} from 'ethers';
import {escrowAbi, verifyEscrowCode, escrowActions, escrowFunding, escrowError, waitForEscrowTransaction} from '../../utils/escrowState';
import {savedEscrows,saveEscrow} from '../../utils/escrowRecovery';
import './CheckoutPage.css';
import './EscrowDemoPage.css';

const storedEscrows=()=>{try{return savedEscrows(window.localStorage)}catch{return []}};
const when=value=>new Date(Number(value)*1000).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'});
const states = ['Deal not found', 'Funds held', 'Dispatched', 'In dispute', 'Ready for seller withdrawal', 'Ready for buyer withdrawal'];
const instructions = [
  'Check the escrow reference and contract address, then refresh.',
  'The seller can mark dispatch or refund the buyer. Funds remain in escrow.',
  'The buyer can confirm receipt to release funds, or either participant can open a dispute before the resolution deadline.',
  'The agreed arbiter can release or refund funds before the resolution deadline.',
  'The seller can withdraw the released coins using their own wallet.',
  'The buyer can withdraw the refunded coins using their own wallet.',
];

export default function EscrowDemoPage({invoice=null,orderId=null,onTransaction,onSubmitted,onFailure,allowFunding=true}) {
  const [history,setHistory]=useState(storedEscrows);
  const configured=invoice?.contract || import.meta.env.VITE_TESTNET_ESCROW_ADDRESS || '';
  const initial=history.find(row=>!configured || row.contract.toLowerCase()===configured.toLowerCase());
  const [contractAddress, setContractAddress] = useState(configured || initial?.contract || '');
  const [account, setAccount] = useState('');
  const [dealId, setDealId] = useState(invoice?.reference || initial?.id || '');
  const [deal, setDeal] = useState(null);
  const [seller, setSeller] = useState(invoice?.seller || '');
  const [arbiter, setArbiter] = useState(invoice?.arbiter || '');
  const [amount, setAmount] = useState(invoice?formatEther(invoice.amount_wei):'0.001');
  const [credit, setCredit] = useState('0');
  const [chainTime, setChainTime] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState(initial?.hash || '');
  const [pending,setPending]=useState(initial?.status==='pending'?initial:null);
  const pendingRef=useRef(pending);
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
  const remember=row=>{try{saveEscrow(row,window.localStorage);setHistory(storedEscrows())}catch{ /* Copyable reference and transaction link remain available. */ }};
  const updatePending=row=>{pendingRef.current=row;setPending(row)};
  const connection = async () => {
    const started=version.current;
    const unchanged=()=>{if(started!==version.current)throw Error('Wallet or network changed. Reconnect before continuing.');};
    if (!window.ethereum) throw Error('Install or open a compatible Ethereum wallet, then select Sepolia.');
    if (!isAddress(contractAddress)) throw Error('Enter your deployed escrow contract address first.');
    const provider = new BrowserProvider(window.ethereum, undefined, {cacheTimeout: -1});
    await provider.send('eth_requestAccounts', []);
    unchanged();
    if ((await provider.getNetwork()).chainId !== 11155111n) throw Error('Select Sepolia in your wallet, then reconnect.');
    verifyEscrowCode(await provider.getCode(contractAddress));
    unchanged();
    const signer = await provider.getSigner();
    unchanged();
    const unresolved=storedEscrows().find(row=>row.status==='pending' && row.contract.toLowerCase()===contractAddress.toLowerCase());
    if(!pendingRef.current && unresolved)updatePending(unresolved);
    return {contract: new Contract(contractAddress, escrowAbi, signer), address:contractAddress, signer, provider, version: started};
  };
  const load = async (context, key) => {
    const {contract, signer, provider} = context;
    if (key && !/^0x[0-9a-fA-F]{64}$/.test(key)) throw Error('Paste the complete escrow reference: 0x followed by 64 hexadecimal characters.');
    const awaiting=pendingRef.current;
    const [balance, result, block, receipt] = await Promise.all([
      contract.credits(signer.address), key ? contract.deals(key) : null, provider.getBlock('latest'), awaiting?provider.getTransactionReceipt(awaiting.hash):null,
    ]);
    if (context.version !== version.current) return;
    if(awaiting && receipt && [0,1].includes(receipt.status) && pendingRef.current?.hash===awaiting.hash){
      remember({...awaiting,status:receipt.status===1?'confirmed':'failed'});updatePending(null);
      if(receipt.status===0)setError('The last transaction failed on-chain. No escrow action was applied; your wallet may still have paid a network fee.');
    }
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
    if(pendingRef.current)throw Error('Refresh the pending transaction before submitting another action.');
    const [chain,accounts]=await Promise.all([context.provider.send('eth_chainId',[]),context.provider.send('eth_accounts',[])]);
    if(context.version!==version.current || BigInt(chain)!==11155111n || accounts[0]?.toLowerCase()!==context.signer.address.toLowerCase())throw Error('Wallet or network changed. Reconnect before continuing.');
    const tx = await context.contract[method](...args, options);
    let record={contract:context.address,id:key,hash:tx.hash,status:'pending'};
    remember(record);updatePending(record);setTxHash(record.hash);
    setMessage('Transaction submitted. Waiting for network confirmation…');
    if(onSubmitted){try{await onSubmitted({hash:record.hash,method})}catch{/* Public reference remains available for a later server check. */}}
    try{
      await waitForEscrowTransaction(tx,hash=>{setTxHash(hash);record={...record,hash};remember(record);updatePending(record)});
      remember({...record,status:'confirmed'});updatePending(null);
    }catch(cause){
      if(cause.cancelled || cause.receipt?.status===0){
        remember({...record,status:'failed'});updatePending(null);
        if(onFailure){try{await onFailure({hash:cause.replacement?.hash || cause.receipt?.hash || record.hash,method})}catch{/* A manual status check remains available. */}}
      }
      throw cause;
    }
    if(onTransaction){
      try{await onTransaction({hash:record.hash,method})}catch{setError('Transaction confirmed on-chain. Check the order payment record before retrying.')}
    }
    if (context.version !== version.current) {
      setMessage('Transaction confirmed. Reconnect the active wallet to refresh this escrow.'); return;
    }
    try {
      await load(context, key);
      if (context.version === version.current) setMessage('Transaction confirmed. Escrow and withdrawal balance refreshed.');
    } catch {
      setMessage('Transaction confirmed. Refresh the escrow to load its latest status; do not repeat the transaction.');
    }
  };
  const actions = escrowActions(deal, account, chainTime);
  const state = Number(deal?.state ?? 0);
  const writeDisabled=busy || Boolean(pending);
  const Title=invoice?'h2':'h1';
  const refreshMessage=()=>pendingRef.current?'Transaction confirmation is still pending. Refresh again before submitting another action.':'Escrow and withdrawal balance refreshed.';
  const action = (method, args = [dealId]) => perform(context => transact(context, method, args));
  const copyId = async () => {
    try { await navigator.clipboard.writeText(dealId); setCopied(true); }
    catch { setError('Could not copy automatically. Select the escrow reference and copy it manually.'); }
  };
  return <main className="checkout-container escrow-demo">
    <Link to={invoice?'/orders':'/checkout'} className="checkout-back">{invoice?'Back to orders':'Back to checkout'}</Link>
    <header className="escrow-header"><p className="escrow-badge">Sepolia · Test network</p><Title className="checkout-title">{invoice?`Wallet actions · order #${orderId}`:'Escrow payment'}</Title>
      <p className="checkout-intro">{invoice?'Fund the amount assigned to this order. The server verifies funding before updating its payment record. Sepolia test ETH has no monetary value.':'Funds are held until receipt is confirmed or a refund is agreed. Uses test ETH with no monetary value; this escrow does not pay for a food order.'}</p></header>
    <ol className="escrow-steps"><li>Buyer funds escrow</li><li>Seller marks dispatch</li><li>Buyer confirms receipt</li><li>Seller withdraws</li></ol>
    {error && <p className="checkout-error" role="alert">{error}</p>}
    {message && <p className="escrow-status" role="status">{message}</p>}
    {pending && <p className="escrow-pending" role="status">A submitted transaction still needs confirmation. Use Refresh escrow to check it before sending another payment or action.</p>}
    {txHash && <p><a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction</a></p>}
    <div className="checkout-grid"><div className="checkout-main">
      <section className="checkout-section"><h2>1. Connect your wallet</h2>
        <fieldset disabled={busy}><label>Escrow contract address<input autoComplete="off" spellCheck={false} readOnly={Boolean(invoice)} placeholder="0x…" value={contractAddress} onChange={event => {
          setContractAddress(event.target.value.trim()); clearConnection(); setError(''); setMessage(''); setTxHash(''); updatePending(null);
        }}/></label><button className="checkout-submit" onClick={() => perform(async context => {await load(context, dealId); if (context.version === version.current) setMessage(refreshMessage());})}>{account ? 'Reconnect wallet' : 'Connect wallet'}</button></fieldset>
        {account && <p className="escrow-address"><strong>Connected wallet</strong><br/>{account}{deal && state > 0 && <><br/>Role: {actions.role}</>}</p>}
        <p className="checkout-hint">Switch between buyer, seller and arbiter in your wallet extension. Reconnect after switching.</p>
      </section>
      <section className="checkout-section"><h2>2. Fund the escrow</h2>
        <form onSubmit={event => {
          event.preventDefault();
          perform(async context => {
            if(pendingRef.current)throw Error('Refresh the pending transaction before creating another escrow.');
            if(invoice && context.signer.address.toLowerCase()!==invoice.buyer)throw Error('Connect the buyer wallet assigned to this order before funding.');
            const paySeller=invoice?.seller || seller,payArbiter=invoice?.arbiter || arbiter;
            const value = invoice?BigInt(invoice.amount_wei):escrowFunding(paySeller, payArbiter, context.signer.address, amount);
            const block = await context.provider.getBlock('latest');
            const key = invoice?.reference || hexlify(randomBytes(32));
            setDealId(key); setDeal(null); setCopied(false);
            await transact(context, 'fund', [key, paySeller, payArbiter, (invoice?.dispatch_by || block.timestamp + 3600)], key, {value});
          });
        }}><fieldset disabled={writeDisabled}>
          <label>Seller wallet<input required autoComplete="off" spellCheck={false} readOnly={Boolean(invoice)} placeholder="0x…" value={seller} onChange={event => setSeller(event.target.value.trim())}/></label>
          <label>Arbiter wallet<input required autoComplete="off" spellCheck={false} readOnly={Boolean(invoice)} placeholder="0x…" value={arbiter} onChange={event => setArbiter(event.target.value.trim())}/></label>
          <label>Amount (ETH)<input required readOnly={Boolean(invoice)} type="number" min="0.000000000000000001" max="0.01" step="any" value={amount} onChange={event => setAmount(event.target.value)}/></label>
          <p className="checkout-hint">Use three distinct wallets. {invoice?'Dispatch deadline follows this order’s delivery arrangement.':'Dispatch is due one hour after the latest chain timestamp.'} Your wallet displays gas fees before approval.</p>
          <button className="checkout-submit" disabled={!account || Boolean(invoice && (state>0 || !allowFunding || account.toLowerCase()!==invoice.buyer))}>Fund escrow</button>
        </fieldset></form>
      </section>
    </div><aside className="checkout-section"><h2>3. Manage your escrow</h2>
      <fieldset disabled={busy}><label>Escrow reference<input autoComplete="off" spellCheck={false} readOnly={Boolean(invoice)} placeholder="0x…" value={dealId} onChange={event => {setDealId(event.target.value.trim()); setDeal(null); setCopied(false);}}/></label>
        <div className="checkout-actions"><button disabled={!dealId} onClick={() => {
          if (!/^0x[0-9a-fA-F]{64}$/.test(dealId)) {setError('Paste the complete escrow reference: 0x followed by 64 hexadecimal characters.'); return;}
          perform(async context => {await load(context, dealId); if (context.version === version.current) setMessage(refreshMessage());});
        }}>Refresh escrow</button><button disabled={!/^0x[0-9a-fA-F]{64}$/.test(dealId)} onClick={copyId}>{copied ? 'Copied' : 'Copy ID'}</button></div></fieldset>
      <p className="checkout-hint">Copy this reference for the seller and arbiter. Recent references are also saved in this browser when storage is available. Never enter customer details on-chain.</p>
      {deal && <div className="escrow-deal"><h3>{states[state]}</h3><p>{instructions[state]}</p>
        {state > 0 && <><p><strong>{formatEther(deal.amount)} ETH</strong> · Your role: {actions.role}</p>
          <details><summary>Participants and deadlines</summary><p className="escrow-address">Buyer: {deal.buyer}<br/>Seller: {deal.seller}<br/>Arbiter: {deal.arbiter}</p>
            <p>Dispatch by: {when(deal.dispatchBy)}<br/>Resolve by: {when(deal.resolveBy)} · Malaysia time</p></details>
          <div className="checkout-actions">
            {actions.dispatch && <button disabled={writeDisabled} onClick={() => action('dispatch')}>Mark dispatched</button>}
            {actions.confirm && <button disabled={writeDisabled} onClick={() => action('confirmReceipt')}>Confirm receipt & release</button>}
            {actions.dispute && <button disabled={writeDisabled} onClick={() => action('dispute')}>Open dispute</button>}
            {actions.refund && <button disabled={writeDisabled} onClick={() => action('refund')}>{actions.role === 'Seller' ? 'Refund buyer' : 'Claim refund'}</button>}
            {actions.resolve && <><button disabled={writeDisabled} onClick={() => action('resolve', [dealId, true])}>Refund buyer</button><button disabled={writeDisabled} onClick={() => action('resolve', [dealId, false])}>Release to seller</button></>}
          </div>
          {![actions.dispatch, actions.confirm, actions.dispute, actions.refund, actions.resolve].some(Boolean) && [1,2,3].includes(state) && <p className="checkout-hint">No action is currently available for this wallet. Refresh after a deadline or switch to the required participant.</p>}
        </>}
      </div>}
      <div className="escrow-withdrawal"><h3>Your withdrawal balance</h3><p><strong>{credit} ETH</strong></p>
        <button disabled={writeDisabled || !account || Number(credit) <= 0} onClick={() => action('withdraw', [])}>Withdraw funds</button>
        <p className="checkout-hint">Released or refunded funds become withdrawal credit. The recipient must withdraw separately.</p></div>
    </aside></div>
    {history.length>0 && <details className="escrow-history"><summary>Recent escrows in this browser</summary><p>Public references and transaction hashes only. Clearing browser storage removes this list; keep a separate copy of your reference.</p><ul>{history.map(row=><li key={row.contract+row.id}><code>{row.id.slice(0,10)}…{row.id.slice(-8)}</code><span>{row.status==='pending'?'Confirmation pending':row.status==='confirmed'?'Confirmed transaction':'Transaction not completed'}</span><button type="button" disabled={busy} onClick={()=>{clearConnection();setContractAddress(row.contract);setDealId(row.id);setTxHash(row.hash);updatePending(row.status==='pending'?row:null);setError('');setMessage('Reference restored. Connect your wallet to read its current on-chain status.')}}>Open escrow</button></li>)}</ul></details>}
    <details className="escrow-limits"><summary>Setup, refunds and limits</summary>
      <p>Deploy <code>escrow/PreorderEscrow.sol</code> on Sepolia using the repository’s escrow README. No contract is deployed automatically. The app verifies deployed bytecode against the compiled version in the repository before allowing transactions.</p>
      <p>The seller may refund any unsettled deal. The buyer may refund after missed dispatch, or after the resolution deadline (seven days after dispatch was due). Until that resolution deadline, either participant may dispute a dispatched deal and the arbiter may decide its outcome.</p>
      <p>This contract has not received an independent security audit and cannot verify physical delivery. A buyer may reclaim an unresolved deal after the deadline, even if delivery occurred. Never use real funds or put customer information on-chain.</p>
    </details>
  </main>;
}
