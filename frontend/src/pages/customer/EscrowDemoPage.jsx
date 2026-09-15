import {useState} from 'react';
import {Link} from 'react-router-dom';
import {BrowserProvider,Contract,isAddress,hexlify,randomBytes,parseEther,formatEther} from 'ethers';
import './CheckoutPage.css';

const abi=[
 'function fund(bytes32 id,address seller,address arbiter,uint256 dispatchBy) payable',
 'function deals(bytes32) view returns(address buyer,address seller,address arbiter,uint256 amount,uint256 dispatchBy,uint256 resolveBy,uint8 state)',
 'function credits(address) view returns(uint256)',
 'function dispatch(bytes32)', 'function confirmReceipt(bytes32)', 'function refund(bytes32)',
 'function dispute(bytes32)', 'function resolve(bytes32,bool)', 'function withdraw()',
];
const states=['Not found','Funds held','Dispatched','In dispute','Released to seller','Refunded to buyer'];

export default function EscrowDemoPage(){
 const [contractAddress,setContractAddress]=useState(import.meta.env.VITE_TESTNET_ESCROW_ADDRESS || '');
 const [account,setAccount]=useState(''),[dealId,setDealId]=useState(''),[deal,setDeal]=useState(null);
 const [seller,setSeller]=useState(''),[arbiter,setArbiter]=useState(''),[amount,setAmount]=useState('0.001');
 const [credit,setCredit]=useState('0'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [txHash,setTxHash]=useState('');
 const connection=async()=>{
  if(!window.ethereum)throw Error('Open this page in a browser with a compatible Ethereum wallet. Select Sepolia and use test coins only.');
  const provider=new BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts',[]);
  if((await provider.getNetwork()).chainId!==11155111n)throw Error('Select the Sepolia test network in your wallet, then try again.');
  if(!isAddress(contractAddress))throw Error('Enter the deployed PreorderEscrow contract address on Sepolia.');
  if(await provider.getCode(contractAddress)==='0x')throw Error('No contract exists at this address on Sepolia.');
  const signer=await provider.getSigner();setAccount(signer.address);
  return {contract:new Contract(contractAddress,abi,signer),signer};
 };
 const load=async(contract,signer,key)=>{
  setCredit(formatEther(await contract.credits(signer.address)));
  if(key){if(!/^0x[0-9a-fA-F]{64}$/.test(key))throw Error('Use the complete 0x-prefixed demo ID.');setDeal(await contract.deals(key));}
 };
 const perform=async(action)=>{
  setBusy(true);setError('');setMessage('');setTxHash('');
  try{const {contract,signer}=await connection();await action(contract,signer);}
  catch(e){setError(e.code==='ACTION_REJECTED'?'You cancelled the wallet request.':e.reason || e.shortMessage || e.message);}
  finally{setBusy(false);}
 };
 const transact=async(contract,signer,method,args=[],key=dealId,options={})=>{
  const tx=await contract[method](...args,options);setTxHash(tx.hash);setMessage('Waiting for Sepolia confirmation…');
  await tx.wait();await load(contract,signer,key);setMessage('Confirmed on Sepolia.');
 };
 const role=deal && account.toLowerCase();
 const buyer=deal && role===deal.buyer.toLowerCase(),owner=deal && role===deal.seller.toLowerCase(),judge=deal && role===deal.arbiter.toLowerCase();
 const state=Number(deal?.state || 0);
 return <main className="checkout-container escrow-demo"><Link to="/checkout" className="checkout-back">← Back to checkout</Link><h1>Testnet escrow lab</h1><p className="dk-offer"><strong>Classroom demonstration · Sepolia test coins only</strong><br/>This is separate from food orders. It does not place an order, mark a purchase paid, or guarantee physical delivery.</p>
 <ol className="escrow-steps"><li>Buyer locks test coins.</li><li>Seller marks dispatch.</li><li>Buyer confirms receipt.</li><li>Seller withdraws released coins.</li></ol>
 <details className="dk-panel"><summary>Refunds, disputes and demonstration limits</summary><p>The seller can refund at any time before settlement. If the dispatch deadline passes with no dispatch, the buyer can reclaim the coins. After dispatch, either participant can ask the agreed arbiter to decide whether to refund or release.</p><p>Seven days after the dispatch deadline, an unresolved deal becomes refundable to the buyer. This avoids a permanent lock if the arbiter disappears, but can disadvantage a seller whose delivery was real. A contract cannot observe food delivery; participants and the arbiter remain trusted. This prototype is unaudited and rejects mainnet deployment.</p><p>Deploy <code>escrow/PreorderEscrow.sol</code> on Sepolia first, following the repository’s escrow README. Use three distinct test wallets. Do not put names, phone numbers, addresses, or real order numbers on-chain.</p></details>
 {error && <p className="checkout-error" role="alert">{error}</p>}{message && <p className="dk-panel" role="status">{message}</p>}{txHash && <p><a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View test transaction ↗</a></p>}
 <div className="checkout-grid"><div className="checkout-main"><section className="checkout-section"><h2>1. Connect to your deployed contract</h2><label>Sepolia contract address<input placeholder="0x…" value={contractAddress} onChange={e=>{setContractAddress(e.target.value.trim());setDeal(null);setAccount('');setCredit('0');}}/></label><button disabled={busy} onClick={()=>perform(async(c,s)=>{await load(c,s,'');setMessage('Connected to Sepolia.');})}>Connect test wallet</button>{account && <p className="escrow-address">Wallet: {account}</p>}<p className="checkout-hint">Switch wallets in your wallet extension, then reconnect or refresh the deal. Every action checks the active network and wallet again.</p></section>
 <section className="checkout-section"><h2>2. Create a demo deal as buyer</h2><form onSubmit={e=>{e.preventDefault();perform(async(c,s)=>{if(!isAddress(seller)||!isAddress(arbiter))throw Error('Enter valid seller and arbiter wallet addresses.');const key=hexlify(randomBytes(32));setDealId(key);await transact(c,s,'fund',[key,seller,arbiter,Math.floor(Date.now()/1000)+3600],key,{value:parseEther(amount)});});}}><label>Seller test wallet<input required placeholder="0x…" value={seller} onChange={e=>setSeller(e.target.value.trim())}/></label><label>Agreed arbiter test wallet<input required placeholder="0x…" value={arbiter} onChange={e=>setArbiter(e.target.value.trim())}/></label><label>Amount in test ETH<input required type="number" min="0.000001" max="0.01" step="0.000001" value={amount} onChange={e=>setAmount(e.target.value)}/></label><p className="checkout-hint">Dispatch deadline: one hour after creation. Contract maximum: 0.01 test ETH. Your wallet shows the test gas fee before you approve.</p><button className="checkout-submit" disabled={busy || !account}>Lock test coins</button></form></section></div>
 <aside className="checkout-section"><h2>3. Inspect and progress a deal</h2><label>Demo ID<input placeholder="0x… (64 hex characters)" value={dealId} onChange={e=>{setDealId(e.target.value.trim());setDeal(null);}}/></label><button disabled={busy || !dealId} onClick={()=>perform((c,s)=>load(c,s,dealId))}>Refresh deal and wallet</button>{deal && <div className="dk-panel"><h3>{states[state]}</h3>{state>0 && <><p>{formatEther(deal.amount)} test ETH · demo amount</p><p className="escrow-address">Buyer: {deal.buyer}<br/>Seller: {deal.seller}<br/>Arbiter: {deal.arbiter}</p><p>Dispatch by: {new Date(Number(deal.dispatchBy)*1000).toLocaleString()}<br/>Resolution deadline: {new Date(Number(deal.resolveBy)*1000).toLocaleString()}</p><div className="checkout-actions">
 {owner && state===1 && <button disabled={busy} onClick={()=>perform((c,s)=>transact(c,s,'dispatch',[dealId]))}>Mark dispatched</button>}
 {buyer && state===2 && <button disabled={busy} onClick={()=>perform((c,s)=>transact(c,s,'confirmReceipt',[dealId]))}>Confirm receipt & release</button>}
 {(buyer || owner) && state===2 && <button disabled={busy} onClick={()=>perform((c,s)=>transact(c,s,'dispute',[dealId]))}>Open dispute</button>}
 {(buyer || owner) && [1,2,3].includes(state) && <button disabled={busy} onClick={()=>perform((c,s)=>transact(c,s,'refund',[dealId]))}>{owner?'Refund buyer':'Claim eligible refund'}</button>}
 {judge && state===3 && <><button disabled={busy} onClick={()=>perform((c,s)=>transact(c,s,'resolve',[dealId,true]))}>Resolve: refund buyer</button><button disabled={busy} onClick={()=>perform((c,s)=>transact(c,s,'resolve',[dealId,false]))}>Resolve: pay seller</button></>}
 </div></>}</div>}<h3>Available to withdraw</h3><p>{credit} test ETH</p><button disabled={busy || Number(credit)===0} onClick={()=>perform((c,s)=>transact(c,s,'withdraw',[],dealId))}>Withdraw released test coins</button><p className="checkout-hint">Settlement credits the recipient. Withdrawal is a separate wallet transaction. The contract checks permissions and deadlines, even if a button is visible.</p></aside></div></main>;
}
