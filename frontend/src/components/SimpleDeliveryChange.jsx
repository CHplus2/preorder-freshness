import {useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError,readApiError} from '../utils/apiError';
import {invalidResponse} from '../utils/apiResponse';
import {deliveryInput} from '../utils/deliverySlots';
import {malaysiaInput} from '../utils/simpleDeliveryTime';
import {timeLabel} from '../utils/fulfilment';
import './SimpleDeliveryChange.css';
const dayLabel=day=>new Date(day+'T12:00:00+08:00').toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric'});
export default function SimpleDeliveryChange({order,onSaved,owner=false}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(()=>order.delivery_at?deliveryInput(order.delivery_at):''),[reason,setReason]=useState(''),[policy,setPolicy]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[attempt,setAttempt]=useState(0),[now,setNow]=useState(()=>Date.now());
 const operation=useRef(false);
 useEffect(()=>{
  if(!open)return;const controller=new AbortController();
  axios.get(`/api/orders/${order.id}/delivery-time/`,{signal:controller.signal,timeout:15000}).then(({data})=>{
   if(typeof data?.eligible!=='boolean'||!Number.isFinite(Date.parse(data.version))||typeof data.reason!=='string'||typeof data.opening_time!=='string'||typeof data.closing_time!=='string'||data.stock_latest_date!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(data.stock_latest_date))throw invalidResponse();
   if(!controller.signal.aborted)setPolicy(data);
  }).catch(e=>{if(!axios.isCancel(e)&&!controller.signal.aborted)setError(readApiError(e));}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[open,order.id,attempt]);
 if(['delivered','cancelled'].includes(order.status))return null;
 const save=async e=>{
  e.preventDefault();if(operation.current||!policy?.eligible)return;operation.current=true;setBusy(true);setError('');
  try{const {data}=await axios.patch(`/api/orders/${order.id}/delivery-time/`,{delivery_at:value+':00+08:00',version:policy.version,reason},{timeout:20000,headers:{'X-CSRFToken':getCookie('csrftoken')}});if(data?.order?.id!==order.id)throw invalidResponse();setOpen(false);await onSaved?.();}
  catch(e){setError(apiError(e));}finally{operation.current=false;setBusy(false)}
 };
 const last=malaysiaInput(now+90*86400000),max=policy?.stock_latest_date?`${policy.stock_latest_date}T${policy.closing_time}`:last;
 const topic=order.delivery_method==='pickup'?'collection':'delivery';
 return <section className="simple-delivery-change"><button type="button" disabled={busy} onClick={()=>{if(!open){setLoading(true);setPolicy(null);setError('');setNow(Date.now())}setOpen(v=>!v)}} aria-expanded={open}>{open?'Close time change':owner?(order.delivery_at?'Change agreed time':'Set agreed time'):`Change ${topic} time`}</button>{open&&<div className="simple-delivery-panel" aria-busy={loading||busy}>
  {loading?<p role="status">Checking available date limits…</p>:policy?<>
   <p>{policy.eligible?`Choose a future ${topic} time between ${timeLabel(policy.opening_time)} and ${timeLabel(policy.closing_time)} (Malaysia time). Received and cancelled orders cannot change time here.`:policy.reason}</p>
   {policy.eligible&&policy.stock_latest_date&&<p className="simple-delivery-stock-limit">{owner?'Ingredients reserved for this order are recorded through ':'You can change this order online to a date up to '}<strong>{dayLabel(policy.stock_latest_date)}</strong>. {owner?'For a later date, review the reserved stock before changing the order.':'For a later date, contact the kitchen to arrange the change.'}</p>}
   {policy.eligible&&<form onSubmit={save}><label>New {topic} date and time<input required type="datetime-local" min={malaysiaInput(now+60000)} max={max<last?max:last} disabled={busy} value={value} onChange={e=>{setValue(e.target.value);setError('')}}/></label><label>Reason for the change<textarea required rows="3" maxLength="300" disabled={busy} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="simple-delivery-actions"><button type="submit" disabled={busy}>{busy?'Saving…':owner?'Save agreed time':'Save new time'}</button><button type="button" disabled={busy} onClick={()=>setOpen(false)}>Keep current time</button></div></form>}
  </>:null}
  {error&&<div className="simple-delivery-error" role="alert"><p>{error}</p><button type="button" disabled={busy||loading} onClick={()=>{setLoading(true);setPolicy(null);setError('');setAttempt(n=>n+1)}}>Refresh date limits</button></div>}
 </div>}</section>;
}
