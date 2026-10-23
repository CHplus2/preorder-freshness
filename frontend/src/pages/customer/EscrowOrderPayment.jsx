import {useEffect,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {BrowserProvider} from 'ethers';
import axios from 'axios';
import EscrowDemoPage from './EscrowDemoPage';
import {getCookie} from '../../utils/cookieUtils';
import {apiError} from '../../utils/apiError';
import {savedEscrows} from '../../utils/escrowRecovery';
import {escrowOrder} from '../../utils/escrowOrder';
import {useOrder} from '../../contexts/OrderContext';
import './CheckoutPage.css';
export default function EscrowOrderPayment(){
 const [params]=useSearchParams(),id=/^[1-9]\d*$/.test(params.get('order') || '')?Number(params.get('order')):null;
 if(!Number.isSafeInteger(id))return <OrderEscrow key="invalid" id={null}/>;
 return <OrderEscrow key={id || 'invalid'} id={id}/>;
}
function OrderEscrow({id}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [recoveryHash,setRecoveryHash]=useState('');
 const restoreTried=useRef(null);
 const pending=useRef(false),attempts=useRef(0),requestVersion=useRef(0);
 const {fetchOrders}=useOrder() || {};
 const url=`/api/orders/${id}/escrow/`;
 useEffect(()=>{if(!id)return;const c=new AbortController(),version=requestVersion.current;axios.get(url,{signal:c.signal,timeout:20000}).then(r=>setData(escrowOrder(r.data,id))).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))});return()=>{requestVersion.current=version+1;c.abort()}},[id,url]);
 const update=async body=>{
  if(pending.current || !id)return;
  pending.current=true;setBusy(true);setError('');const version=requestVersion.current;
  try{
   const response=body.action==='load'?await axios.get(url,{timeout:20000}):await axios.post(url,body,{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(version===requestVersion.current){setData(escrowOrder(response.data,id));void fetchOrders?.();}
  }catch(e){if(version===requestVersion.current){setError(apiError(e));if(body.action==='verify'){try{const latest=await axios.get(url,{timeout:10000});if(version===requestVersion.current)setData(escrowOrder(latest.data,id))}catch{/* Keep the last known state; the submitted hash remains recoverable in the wallet flow. */}}}}
  finally{pending.current=false;if(version===requestVersion.current)setBusy(false)}
 };
 useEffect(()=>{
  if(data?.invoice && !data.invoice.funding_hash && restoreTried.current!==data.invoice.reference){
   restoreTried.current=data.invoice.reference;
   try{const saved=savedEscrows(window.localStorage).find(row=>row.id===data.invoice.reference && row.contract.toLowerCase()===data.invoice.contract);if(saved){setTimeout(()=>update({action:'verify',transaction_hash:saved.hash}),0);return}}catch{/* A manual hash check remains available when browser storage is disabled. */}
  }
  if(!data?.invoice?.funding_hash || ['released','refunded'].includes(data.invoice.state) || attempts.current>=15)return;
  const timer=setTimeout(()=>{attempts.current++;void update({action:'refresh'})},8000);
  return()=>clearTimeout(timer);
 });
 const start=async()=>{
  try{
   if(!window.ethereum)throw Error('Open a compatible Ethereum wallet and select Sepolia.');
   const provider=new BrowserProvider(window.ethereum);await provider.send('eth_requestAccounts',[]);
   if((await provider.getNetwork()).chainId!==11155111n)throw Error('Select Sepolia in your wallet.');
   await update({action:'create',buyer:await (await provider.getSigner()).getAddress()});
  }catch(e){setError(apiError(e));}
 };
 const onTransaction=async ({hash,method})=>{
  attempts.current=0;
  await update(method==='fund'?{action:'verify',transaction_hash:hash}:{action:'refresh'});
 };
 if(!id)return <main className="checkout-container"><h1>Escrow payment</h1><p>Open this payment from a saved order.</p><Link to="/orders">My orders</Link></main>;
 return <>
  <section className="checkout-container escrow-order-status" aria-label={`Order ${id} payment record`}>
   <Link to="/orders">My orders</Link><h1>Escrow · order #{id}</h1>
   {error && <p role="alert">{error}</p>}
   {!data?<><p role="status">{error?'Payment details could not be loaded.':'Loading order payment…'}</p><button disabled={busy} onClick={()=>update({action:'load'})}>Reload payment</button></>:<>
    <p>Order total <strong>RM {data.amount_myr}</strong> · Payment <strong>{data.payment_status==='paid'?'Verified · funds secured':data.payment_status==='refunded'?'Refund credit verified':'Awaiting verified funding'}</strong></p>
    {data.invoice && <p>Chain status: <strong>{data.invoice.state.replaceAll('_',' ')}</strong>{data.invoice.confirmations!=null && <> · Minimum {data.invoice.confirmations} confirmations</>}</p>}
    {data.reason && <p role="status">{data.reason}</p>}
    <p className="checkout-hint">Sepolia test ETH only. The MYR total is the recorded order value; the configured test-ETH quote is not a market exchange rate. Escrow funding, delivery progress and withdrawal are tracked separately.</p>
    {data.invoice && data.payment_status==='unpaid' && <details><summary>Recover a submitted transaction</summary><p>If you already funded this escrow, check the wallet transaction instead of paying again.</p><form onSubmit={event=>{event.preventDefault();update({action:'verify',transaction_hash:recoveryHash.trim()})}}><label>Funding transaction hash<input required pattern="0x[0-9a-fA-F]{64}" maxLength={66} value={recoveryHash} disabled={busy} onChange={event=>setRecoveryHash(event.target.value)}/></label><button disabled={busy}>Verify submitted transaction</button></form></details>}
    {data.invoice?<button type="button" disabled={busy} onClick={()=>{attempts.current=0;update({action:'refresh'})}}>{busy?'Verifying chain…':'Check payment status'}</button>:<><p>{data.reason}</p><button type="button" className="checkout-submit" disabled={busy || !data.can_create} onClick={start}>Connect wallet & prepare payment</button>{!data.config.enabled && <p>Escrow is not configured. Contact the kitchen before paying.</p>}</>}
   </>}
  </section>
  {data?.invoice && <EscrowDemoPage key={data.invoice.reference} invoice={data.invoice} orderId={id} allowFunding={data.can_fund} onSubmitted={({hash,method})=>method==='fund'?onTransaction({hash,method}):Promise.resolve()} onFailure={({hash,method})=>method==='fund'?onTransaction({hash,method}):Promise.resolve()} onTransaction={onTransaction}/>}
 </>;
}
