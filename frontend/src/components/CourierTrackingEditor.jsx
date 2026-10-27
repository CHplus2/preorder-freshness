import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {trackingSaved} from '../utils/courierHandover';

export default function CourierTrackingEditor({order,onSaved,embedded=false}){
 const saved=order.fulfilment_snapshot?.courier || {};
 const [data,setData]=useState({carrier:saved.carrier || '',reference:saved.reference || '',url:saved.url || '',contact_phone:saved.contact_phone || ''});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 if(order.delivery_method==='pickup' || order.status==='cancelled')return null;
 const save=async e=>{e.preventDefault();if(busy || uncertain)return;setBusy(true);setMessage('');setError('');try{const response=await axios.post(`/api/admin/orders/${order.id}/tracking/`,{...data,version:order.updated_at},{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});trackingSaved(response.data,order,data);setMessage('Tracking saved. Order and payment status are unchanged.');onSaved?.('Courier tracking saved. Order and payment status are unchanged.');}catch(failure){if(!failure.response || failure.response.status>=500){setUncertain(true);setError('The tracking update could not be confirmed. Refresh this order before trying again.');}else{setError(apiError(failure));if(failure.response.status===409)setUncertain(true);}}finally{setBusy(false);}};
 const contents=<><p>Add the courier’s reference after arranging delivery. This does not book a courier or mark the order dispatched.</p><form onSubmit={save}><label>Courier name<input disabled={busy || uncertain} required maxLength={80} value={data.carrier} onChange={e=>setData({...data,carrier:e.target.value})}/></label><label>Tracking reference<input disabled={busy || uncertain} required maxLength={100} value={data.reference} onChange={e=>setData({...data,reference:e.target.value})}/></label><label>Courier phone (optional)<input disabled={busy || uncertain} type="tel" maxLength={30} placeholder="+60123456789" value={data.contact_phone} onChange={e=>setData({...data,contact_phone:e.target.value})}/></label><label>Public tracking link (optional)<input disabled={busy || uncertain} type="url" maxLength={500} placeholder="https://…" value={data.url} onChange={e=>setData({...data,url:e.target.value})}/></label><button disabled={busy || uncertain}>{busy?'Saving…':'Save tracking'}</button></form>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}{uncertain && <button type="button" onClick={()=>onSaved?.()}>Refresh order records</button>}</>;
 return embedded?<section className="courier-editor" aria-label={`Tracking for order ${order.id}`}><h4>Courier tracking</h4>{contents}</section>:<details className="courier-editor"><summary>Courier tracking</summary>{contents}</details>;
}
