import {useStorefront} from '../contexts/StorefrontContext';
import {earlierPayment} from '../utils/operationalOrders';
import {orderDate} from '../utils/orderPresentation';
import {paymentStatusLabel,paymentMethodLabel,paymentEventLabel,readPaymentRecords} from '../utils/paymentRecords';
import EarlierPaymentNote from './EarlierPaymentNote';
import {useUI} from '../contexts/UIContext';
import {invalidResponse} from '../utils/apiResponse';
import {useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {paypalRecovery,paypalStatus} from '../utils/paypalResponse';
import PayPalRecovery from './PayPalRecovery';
import './PaymentRecords.css';

export function PaymentSummary({order,data}){
 return <dl className="payment-record-summary"><div><dt>Order total</dt><dd>RM {Number(data.amount).toFixed(2)}</dd></div><div><dt>Payment</dt><dd className={'payment-record-status '+data.payment_status}>{paymentStatusLabel(data.payment_status)}</dd></div><div><dt>Payment method</dt><dd>{paymentMethodLabel(order.payment_method)}</dd></div></dl>;
}
export function PaymentLedger({events}){
 if(!events.length)return <p className="payment-record-empty">No payment or refund records yet.</p>;
 return <ol className="payment-record-ledger">{events.map(event=><li key={event.id}>
  <div className="payment-record-event-heading"><strong>{paymentEventLabel(event)}</strong><strong>RM {Number(event.amount).toFixed(2)}</strong></div>
  <p>{orderDate(event.created_at)} · Malaysia time</p>
  <dl><div><dt>Reference</dt><dd>{event.reference}</dd></div><div><dt>Method</dt><dd>{paymentMethodLabel(event.method)}</dd></div></dl>
  <small>{event.source==='escrow_sepolia'?'Server-verified Sepolia escrow (test funds).':event.source==='paypal_sandbox'?'Server-verified PayPal Sandbox capture (test funds).':event.source==='legacy_unverified'?'Earlier status; original payment evidence and date are unverified.':`Recorded by account #${event.actor ?? 'unavailable'}`}</small>
  {event.note&&<p className="payment-record-note">{event.note}</p>}
 </li>)}</ol>;
}
export default function PaymentRecords({order,onSaved,onBusyChange,heading}){
 const {setAlert}=useUI();
 const currentWorkflow=useStorefront()?.store?.ordering_mode==='simple',historical=currentWorkflow&&earlierPayment(order);
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [kind,setKind]=useState('receipt'),[outcome,setOutcome]=useState('completed');
 const [reference,setReference]=useState(''),[note,setNote]=useState(''),[revision,setRevision]=useState(0);
 const [notice,setNotice]=useState(''),[showRefund,setShowRefund]=useState(false),[refundConfirmed,setRefundConfirmed]=useState(false);
 const retry=useRef(null),checking=useRef(false),feedback=useRef(null),refundField=useRef(null),refundOpener=useRef(null);
 useEffect(()=>{onBusyChange?.(busy)},[busy,onBusyChange]);
 useEffect(()=>{if(showRefund){refundField.current?.focus();refundField.current?.scrollIntoView({block:'center'})}else{refundOpener.current?.focus()}},[showRefund]);
 useEffect(()=>{if(error){feedback.current?.focus();feedback.current?.scrollIntoView({block:'nearest'})}},[error]);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get(`/api/admin/orders/${order.id}/payments/`,{signal:controller.signal}).then(result=>{
   const records=readPaymentRecords(result.data);paypalRecovery(records.paypal_recovery);
   setData(records);setOutcome(records.payment_status==='unpaid'?'completed':'');setKind(records.payment_status==='unpaid'?'receipt':'refund');setShowRefund(!!records.unresolved_refund);setRefundConfirmed(false);
  }).catch(error=>{if(!axios.isCancel(error))setError(apiError(error))});
  return()=>controller.abort();
 },[order.id,revision]);
 const save=async event=>{
  event.preventDefault();if(busy||!data)return;setBusy(true);setError('');
  if(kind==='refund'&&(!outcome||outcome==='completed'&&!refundConfirmed)){setBusy(false);setError('Choose the refund result and confirm completed refunds before recording.');return}
  const body={kind,outcome:kind==='receipt'?'completed':outcome,reference,note,resolves:data.unresolved_refund};
  const key=JSON.stringify(body);
  try{
   if(retry.current?.key!==key)retry.current={key,id:crypto.randomUUID()};
   const result=await axios.post(`/api/admin/orders/${order.id}/payments/`,{...body,request_id:retry.current.id},{headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(!Number.isInteger(result.data?.id))throw invalidResponse();
   setAlert({type:'success',message:'Payment record saved.'});setNotice(kind==='receipt'?'Payment received has been recorded. Food receipt status is unchanged.':'Refund record saved. Food receipt status is unchanged.');
   retry.current=null;setReference('');setNote('');setData(null);setRevision(value=>value+1);
   Promise.resolve().then(()=>onSaved?.()).catch(()=>setError('Payment was saved, but the order view could not refresh. Reload the orders before making another change.'));
  }catch(error){setError(apiError(error))}finally{setBusy(false)}
 };
 const checkPayPal=async()=>{
  if(checking.current||busy)return;checking.current=true;setBusy(true);setError('');setNotice('');
  try{
   const result=await axios.post(`/api/admin/orders/${order.id}/paypal/check/`,{},{timeout:45000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   const payment=paypalStatus(result.data,order.id);
   setNotice(payment.payment_status==='paid'&&payment.state==='completed'?'PayPal confirmed the Sandbox payment. The verified receipt is recorded.':payment.state==='pending'?'PayPal is still processing this payment. It remains unpaid; check again shortly.':'No completed payment was confirmed. The customer can review the saved payment from My orders.');
   setData(null);setRevision(value=>value+1);
   Promise.resolve().then(()=>onSaved?.()).catch(()=>setError('PayPal was checked, but the order list could not refresh. Reload the list before another change.'));
  }catch(error){setError(apiError(error))}finally{checking.current=false;setBusy(false)}
 };
 const canRecord=data&&!historical&&!['escrow','paypal','wallet','deferred'].includes(order.payment_method)&&data.payment_status==='unpaid'&&order.status!=='cancelled';
 const refundForm=data&&!historical&&order.payment_method!=='escrow'&&data.payment_status==='paid'&&showRefund;
 return <section className="payment-records" aria-label={`Payment records for order ${order.id}`} aria-busy={busy}>
  <h3>{heading||`Payment records · order #${order.id}`}</h3>
  {notice&&<p className="payment-record-feedback" role="status">{notice}</p>}
  {error&&<div className="payment-record-error" role="alert" tabIndex={-1} ref={feedback}><p>{error}</p><button type="button" disabled={busy} onClick={()=>{setData(null);setError('');setRevision(value=>value+1)}}>Reload records</button></div>}
  {!data?(!error&&<p role="status">Loading payment records…</p>):<>
   <PaymentSummary order={order} data={data}/>
   {historical?<EarlierPaymentNote order={order}/>:<p className="payment-record-guidance">{currentWorkflow?'Record payment only after checking your bank or collecting the cash. An uploaded receipt is evidence to review, not confirmation of payment.':data.policy}</p>}
   {order.payment_proof&&<div className="payment-proof-review"><div><strong>Customer payment proof</strong><p>Amount submitted: RM {Number(order.payment_proof.amount).toFixed(2)}. Check this against your bank records.</p></div><a href={order.payment_proof.url} target="_blank" rel="noopener noreferrer">Open payment proof<span className="sr-only"> in a new tab</span></a></div>}
   {(canRecord||refundForm)&&<form className="payment-record-form" onSubmit={save}>
    <h4>{refundForm?'Record a refund already made':'Confirm full payment received'}</h4>
    {refundForm&&<>
     <p>This records the outcome. It does not send a bank transfer or return cash.</p>
     <label>Refund outcome<select ref={refundField} required disabled={busy} value={outcome} onChange={event=>{setOutcome(event.target.value);setRefundConfirmed(false)}}>
      <option value="" disabled>Choose the actual result</option><option value="completed">Completed {order.payment_method==='wallet'?'— return test credits now':'— money already returned'}</option>
      {!data.unresolved_refund&&<option value="pending">Pending — no money recorded as returned</option>}<option value="failed">Failed — no money returned</option>
     </select></label>
     {data.unresolved_refund&&<p>Resolve pending refund #{data.unresolved_refund} before starting another.</p>}
     {outcome==='completed'&&<label className="refund-confirmation"><input type="checkbox" required disabled={busy} checked={refundConfirmed} onChange={event=>setRefundConfirmed(event.target.checked)}/>{order.payment_method==='wallet'?'I understand this will return the recorded test credits.':`I confirm RM ${data.amount} has already been returned to the customer outside this website.`}</label>}
    </>}
    <label>Transaction or receipt reference<input required disabled={busy} maxLength={200} value={reference} onChange={event=>setReference(event.target.value)}/><small>Use the bank transaction reference, or your own cash receipt reference. The website does not generate a bank reference.</small></label>
    <label>Note (optional)<textarea disabled={busy} maxLength={500} rows={2} value={note} onChange={event=>setNote(event.target.value)}/></label>
    <div className="payment-record-form-actions"><button className="payment-record-primary" disabled={busy||refundForm&&(!outcome||outcome==='completed'&&!refundConfirmed)}>{busy?'Recording…':refundForm?'Save refund record':`Confirm RM ${Number(data.amount).toFixed(2)} received`}</button>
    {refundForm&&!data.unresolved_refund&&<button type="button" disabled={busy} onClick={()=>{setShowRefund(false);setRefundConfirmed(false);setError('')}}>Cancel refund entry</button>}</div>
   </form>}
   {order.status==='cancelled'&&data.payment_status==='unpaid'&&!historical&&<p>No new payment can be recorded for a cancelled order.</p>}
   {!historical&&order.payment_method==='escrow'&&<p>This earlier test-network payment is retained for reference. Escrow payment actions are no longer available.</p>}
   {!historical&&order.payment_method==='paypal'&&<PayPalRecovery recovery={data.paypal_recovery} paymentStatus={data.payment_status} busy={busy} onCheck={checkPayPal}/>}
   {!historical&&order.payment_method==='paypal'&&data.payment_status==='paid'&&<p>A record here does not send a PayPal refund. Complete any test refund in the PayPal Sandbox dashboard first.</p>}
   <details className="payment-record-history"><summary>Payment history <span>({data.events.length})</span></summary><PaymentLedger events={data.events}/></details>
   {!historical&&data.payment_status==='paid'&&order.payment_method!=='escrow'&&!showRefund&&<div className="payment-refund-action"><button type="button" ref={refundOpener} disabled={busy} onClick={()=>{setShowRefund(true);setOutcome('');setRefundConfirmed(false)}}>{order.payment_method==='wallet'?'Return test credits':'Record a refund already made'}</button></div>}
  </>}
 </section>;
}
