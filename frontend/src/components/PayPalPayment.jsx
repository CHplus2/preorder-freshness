import {useEffect,useRef,useState} from 'react';
import {PayPalScriptProvider,PayPalButtons,usePayPalScriptReducer} from '@paypal/react-paypal-js';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {paypalStatus} from '../utils/paypalResponse';
import usePayPalConfig from '../hooks/usePayPalConfig';
import './PayPalPayment.css';

function PaymentButtons({onCreate,onApprove,onCancel,onError}){
 const [{isPending,isRejected},dispatch]=usePayPalScriptReducer();
 return <>{isPending && <p role="status">Loading PayPal Sandbox…</p>}{isRejected?<div role="alert"><p>PayPal could not load. Your preorder is saved; check payment status before retrying.</p><button type="button" onClick={()=>dispatch({type:'setLoadingStatus',value:'initial'})}>Retry PayPal</button></div>:<PayPalButtons style={{layout:'vertical',label:'pay',height:45}} fundingSource="paypal" createOrder={onCreate} onApprove={onApprove} onCancel={onCancel} onError={onError}/>}</>;
}
const messages={
 uncertain:'The payment result is not confirmed yet. Check payment status before trying again. Your preorder is saved.',
 pending:'PayPal is still processing this Sandbox payment. It is not marked paid yet. Check payment status again shortly.',
 review_required:'This payment needs review. Check payment status and contact the kitchen before paying again.',
};
export default function PayPalPayment({orderId,onPaid}){
 const {config,error:configError,retry:retryConfig}=usePayPalConfig();
 const [payment,setPayment]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 const pending=useRef(false),mounted=useRef(true);
 const url=`/api/orders/${orderId}/paypal/`;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get(url,{signal:controller.signal}).then(({data})=>{setPayment(paypalStatus(data,orderId));setError('')}).catch(e=>{if(!axios.isCancel(e))setError(e.response?.status===404?'This PayPal preorder is unavailable to your account.':'Could not load this payment. Your preorder may already be saved; check My orders before starting again.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[url,orderId,attempt]);
 async function act(action,providerOrder){
  if(pending.current)throw new Error('A payment check is already running.');
  pending.current=true;setBusy(true);setError('');setNotice('');
  try{
   const {data}=await axios.post(url,{action,...(providerOrder?{paypal_order_id:providerOrder}:{})},{timeout:45000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   const next=paypalStatus(data,orderId);
   if(mounted.current){setPayment(next);if(next.payment_status==='paid')onPaid?.();}
   return next;
  }catch(e){
   if(mounted.current){
    if(e.response?.data?.order_id===orderId){try{setPayment(paypalStatus(e.response.data,orderId))}catch{/* Do not use malformed state. */}}
    const safe=e.response?.status<500 && typeof e.response.data?.detail==='string'?e.response.data.detail:'The payment result could not be confirmed. Check payment status before trying again; do not place another order.';
    setError(safe);
   }
   throw e;
  }finally{pending.current=false;if(mounted.current)setBusy(false)}
 }
 async function create(){
  const data=await act('create');
  if(data.payment_status==='paid')throw new Error('This preorder is already paid.');
  if(!data.paypal_order_id || !data.can_pay)throw new Error('This payment needs review. Check payment status.');
  return data.paypal_order_id;
 }
 async function approve(data){
  try{await act('capture',data.orderID)}catch{/* act provides recovery without claiming payment failed. */}
 }
 const paid=payment?.payment_status==='paid';
 const verified=paid && payment.state==='completed' && !!payment.capture_id;
 return <section className="paypal-payment" aria-label="PayPal Sandbox payment">
  <header><span className="paypal-sandbox-badge">PayPal Sandbox</span><h2>{verified?'Payment confirmed':paid?'Payment recorded':payment?.payment_status==='refunded'?'Refund recorded':'Complete your payment'}</h2></header>
  <p className="paypal-test-note">No real money is transferred.{!paid && payment?.payment_status!=='refunded' && ' Use a PayPal Sandbox buyer account.'}</p>
  {loading?<p role="status">Loading payment status…</p>:<>
   {payment && <dl className="paypal-payment-summary"><div><dt>Preorder</dt><dd>#{orderId}</dd></div><div><dt>Order total</dt><dd>RM {payment.amount}</dd></div><div><dt>Payment</dt><dd>{paid?'Paid':payment.payment_status==='refunded'?'Refund recorded':'Awaiting verified payment'}</dd></div></dl>}
   {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
   {paid?<>{payment.order_status==='cancelled' && <p role="alert">This preorder was cancelled, but a Sandbox payment was recorded. Contact the kitchen to review a refund. No automatic refund has been issued.</p>}<p role="status">{verified?'Your payment is verified. Track preparation and delivery in My orders.':'This payment is recorded as paid, but has no verified Sandbox capture reference. Contact the kitchen about this earlier record.'}</p>{payment.capture_id && <p className="paypal-reference">Capture reference <code>{payment.capture_id}</code></p>}</>:<>
    {messages[payment?.state] && <p role="status">{messages[payment.state]}</p>}
    {payment?.reason && <p>{payment.reason}</p>}
    {payment && !payment.configured && <p>PayPal Sandbox is currently unavailable. Your preorder remains saved and unpaid.</p>}
    {configError && <p role="alert">Payment settings could not be loaded. <button type="button" onClick={retryConfig}>Retry payment settings</button></p>}
    {payment?.can_pay && config?.enabled && !error && !['uncertain','pending','review_required'].includes(payment.state) && <PayPalScriptProvider options={{clientId:config.client_id,currency:'MYR',intent:'capture',components:'buttons',commit:true}}><PaymentButtons onCreate={create} onApprove={approve} onCancel={()=>setNotice('PayPal approval was closed. Your preorder remains saved. Check payment status before retrying.')} onError={()=>setError('PayPal could not complete the checkout. Check payment status before retrying; your preorder is saved.')}/></PayPalScriptProvider>}
    {payment?.can_pay && !payment.paypal_order_id && payment.state==='uncertain' && <button type="button" disabled={busy} onClick={()=>act('create').catch(()=>{})}>Recover payment session</button>}
    {busy && <p role="status">Checking PayPal securely…</p>}
    <button type="button" className="paypal-check-status" disabled={busy} onClick={()=>{if(payment)act('refresh').catch(()=>{});else{setLoading(true);setAttempt(n=>n+1)}}}>{busy?'Checking…':'Check payment status'}</button>
    <p className="paypal-recovery-note">Closing this page does not cancel the preorder or release its preparation booking. Return through My orders to resume. Contact the kitchen to cancel an unwanted preorder.</p>
   </>}
  </>}
 </section>;
}
