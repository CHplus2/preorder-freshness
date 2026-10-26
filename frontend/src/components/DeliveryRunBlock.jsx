import {deliveryRunRequest} from '../utils/deliveryRun';
import {useState} from 'react';
import axios from 'axios';
import {deliveryInput} from '../utils/deliverySlots';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
export default function DeliveryRunBlock({order,onChanged}){
 const [openedAt]=useState(()=>Date.now());
 const [open,setOpen]=useState(false),[start,setStart]=useState(()=>Date.parse(order.dispatch_by || '')>openedAt?deliveryInput(order.dispatch_by):''),[minutes,setMinutes]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 if(order.delivery_method==='pickup' || !order.dispatch_by || ['cancelled','delivered'].includes(order.status))return null;
 const first=Date.parse(start+':00+08:00'),amount=Number(minutes),valid=Number.isFinite(first) && Number.isInteger(amount) && amount>=1 && amount<=720;
 const end=valid?new Date(first+amount*60000).toISOString():'';
 const save=async event=>{
  event.preventDefault();if(busy)return;
  let payload;
  try{payload=deliveryRunRequest(start,minutes,order.id);}catch(error){setError(error.message);return;}
  setBusy(true);setError('');
  try{const {data}=await axios.post('/api/admin/kitchen-blocks/',payload,{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});if(!Number.isInteger(data?.id))throw new Error('Unverified block');setSaved(true);onChanged?.('Delivery run reserved. Review this independent block if the order or route changes.');}catch(e){setError(!e.response || e.response.status>=500?'The block could not be confirmed. Check Kitchen availability before retrying.':apiError(e));}finally{setBusy(false);}
 };
 return <div className="delivery-run-block"><button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} disabled={busy}>{open?'Close delivery run':'Plan my delivery run'}</button>{open && (saved?<p role="status">Kitchen time reserved. Manage or remove this independent block in Kitchen availability.</p>:<form onSubmit={save}><h4>Time away from the kitchen</h4><p>Use this only if you will leave the kitchen yourself. Courier tracking does not reserve your driving time.</p><label>Leave the kitchen at (Malaysia)<input type="datetime-local" required value={start} disabled={busy} onChange={e=>setStart(e.target.value)}/></label><label>Minutes away, including handover and return<input type="number" min={1} max={720} step={1} required value={minutes} disabled={busy} onChange={e=>setMinutes(e.target.value)}/></label>{end && <p>Back by {new Date(end).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})}.</p>}<p>This reserves all kitchen work and equipment. Existing preparation conflicts must be resolved first. It is an independent availability block: review or remove it after order or route changes. No driver is booked and order status stays unchanged.</p><button disabled={busy}>{busy?'Reserving…':'Reserve my time away'}</button>{error && <p role="alert">{error}</p>}</form>)}</div>;
}
