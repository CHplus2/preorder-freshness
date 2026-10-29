import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import axios from 'axios';
import {useAuth} from '../contexts/AuthContext';
import {getCookie} from '../utils/cookieUtils';
import {apiError,readApiError} from '../utils/apiError';
import {invalidResponse} from '../utils/apiResponse';
import './DeferredOrderPayment.css';

const methods=['paypal','manual','cod','escrow'];
export default function DeferredOrderPayment({order,onSaved}){
 const {isSessionCurrent}=useAuth();
 const navigate=useNavigate();
 const [data,setData]=useState(null),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const operation=useRef(false),attempt=useRef(null),controller=useRef(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();}},[]);
 if(order.payment_status!=='unpaid' || ['cancelled','delivered'].includes(order.status))return null;
 const waiting=order.preparation_plan?.needs_review || !order.preparation_at || !order.preparation_end_at;
 async function load(){
  if(operation.current)return;
  operation.current=true;setBusy(true);setError('');controller.current=new AbortController();
  try{
   const {data}=await axios.get(`/api/orders/${order.id}/payment-choice/`,{timeout:15000,signal:controller.current.signal});
   if(!mounted.current || !isSessionCurrent())return;
   if(data?.order_id!==order.id || !Array.isArray(data.options) || typeof data.reason!=='string' || data.options.some(o=>!methods.includes(o.id) || typeof o.label!=='string' || typeof o.note!=='string' || (o.id==='cod' && order.delivery_method!=='pickup')))throw invalidResponse();
   setData(data);
  }catch(e){if(!axios.isCancel(e) && mounted.current && isSessionCurrent())setError(readApiError(e));}
  finally{operation.current=false;if(mounted.current && isSessionCurrent())setBusy(false);}
 }
 async function save(e){
  e.preventDefault();if(operation.current || !data?.options.some(o=>o.id===value) || !isSessionCurrent())return;
  operation.current=true;setBusy(true);setError('');
  try{
   attempt.current ??=crypto.randomUUID();
   const {data}=await axios.post(`/api/orders/${order.id}/payment-choice/`,{payment:value,request_id:attempt.current},{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(!mounted.current || !isSessionCurrent())return;
   if(data?.order_id!==order.id || data.payment_method!==value || !['unpaid','paid','refunded'].includes(data.payment_status))throw invalidResponse();
   onSaved?.();
   if(['paypal','escrow'].includes(value) && window.location.pathname==='/orders')navigate(`/payment/${value}?order=${order.id}`);
  }catch(e){if(mounted.current && isSessionCurrent()){setUncertain(!e.response || e.response.status>=500 || e.code==='INVALID_RESPONSE');setError(apiError(e));}}
  finally{operation.current=false;if(mounted.current && isSessionCurrent())setBusy(false);}
 }
 return <section className="deferred-order-payment" aria-label="Payment after confirmation"><h3>Payment after confirmation</h3>
  {waiting?<p>The kitchen must confirm your preparation plan first. No payment has been taken.</p>:<>
   <p>Your request is saved. Choose payment for this order; this does not create another order or take payment.</p>
   {!data && <button type="button" disabled={busy} onClick={load}>{busy?'Loading payment choices…':'Choose payment'}</button>}
   {data && (data.reason?<p role="status">{data.reason}</p>:data.options.length?<form onSubmit={save}><fieldset disabled={busy || uncertain}><legend>Payment method for order #{order.id}</legend><div className="deferred-payment-options">{data.options.map(o=><label key={o.id}><input type="radio" name={`order-payment-${order.id}`} value={o.id} checked={value===o.id} onChange={()=>{setValue(o.id);attempt.current=null;}}/><span><strong>{o.label}</strong><small>{o.note}</small></span></label>)}</div></fieldset><button type="submit" disabled={busy || !value}>{busy?'Saving payment choice…':uncertain?'Retry same payment choice':value==='paypal'?'Continue to PayPal':value==='escrow'?'Continue to escrow':'Confirm payment method'}</button></form>:<p>No payment service is available. Contact the kitchen to arrange payment.</p>)}
  </>}
  {error && <p role="alert">{error} Refresh order status to check the saved method before starting again.</p>}
 </section>;
}
