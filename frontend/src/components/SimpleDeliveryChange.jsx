import {useEffect,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {deliveryInput} from '../utils/deliverySlots';

export default function SimpleDeliveryChange({order,onSaved,owner=false}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(()=>order.delivery_at?deliveryInput(order.delivery_at):''),[reason,setReason]=useState(''),[policy,setPolicy]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!open)return;const controller=new AbortController();
  axios.get(`/api/orders/${order.id}/delivery-time/`,{signal:controller.signal}).then(r=>setPolicy(r.data)).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))});
  return()=>controller.abort();
 },[open,order.id]);
 if(['delivered','cancelled'].includes(order.status))return null;
 const save=async e=>{
  e.preventDefault();if(busy||!policy?.eligible)return;setBusy(true);setError('');
  try{await axios.patch(`/api/orders/${order.id}/delivery-time/`,{delivery_at:value+':00+08:00',version:policy.version,reason},{headers:{'X-CSRFToken':getCookie('csrftoken')}});setOpen(false);await onSaved?.();}
  catch(e){setError(apiError(e));}finally{setBusy(false)}
 };
 return <section className="simple-delivery-change"><button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?'Close time change':owner?(order.delivery_at?'Change agreed time':'Set agreed time'):(order.delivery_method==='pickup'?'Change collection time':'Change delivery time')}</button>{open&&<form onSubmit={save}>
  <p>Choose a future time within the kitchen’s delivery hours. The allocated ingredients must remain within their recorded dates. All times are Malaysia time.</p>
  {policy&&!policy.eligible?<p>{policy.reason}</p>:<><label>New delivery or collection time<input required type="datetime-local" value={value} onChange={e=>setValue(e.target.value)}/></label><label>Reason<input required maxLength="300" value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="submit" disabled={busy||!policy}>{busy?'Saving…':'Save agreed time'}</button></>}
  {error&&<p role="alert">{error}</p>}
 </form>}</section>;
}
