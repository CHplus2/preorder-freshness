import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';

export default function CourierTrackingEditor({order,onSaved}){
 const saved=order.fulfilment_snapshot?.courier || {};
 const [data,setData]=useState({carrier:saved.carrier || '',reference:saved.reference || '',url:saved.url || ''});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(order.delivery_method==='pickup' || order.status==='cancelled')return null;
 const save=async e=>{e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{await axios.post(`/api/admin/orders/${order.id}/tracking/`,{...data,version:order.updated_at},{headers:{'X-CSRFToken':getCookie('csrftoken')}});setMessage('Tracking saved. Order and payment status are unchanged.');onSaved?.();}catch(error){setMessage(apiError(error));}finally{setBusy(false);}};
 return <details className="courier-editor"><summary>Courier tracking</summary><p>Add the courier’s reference after arranging delivery. This does not book a courier or mark the order dispatched.</p><form onSubmit={save}><label>Courier name<input required maxLength={80} value={data.carrier} onChange={e=>setData({...data,carrier:e.target.value})}/></label><label>Tracking reference<input required maxLength={100} value={data.reference} onChange={e=>setData({...data,reference:e.target.value})}/></label><label>Public tracking link (optional)<input type="url" maxLength={500} placeholder="https://…" value={data.url} onChange={e=>setData({...data,url:e.target.value})}/></label><button disabled={busy}>{busy?'Saving…':'Save tracking'}</button></form>{message && <p role="status">{message}</p>}</details>;
}
