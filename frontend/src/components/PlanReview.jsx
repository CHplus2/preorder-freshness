import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
const when=d=>new Date(d).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'});
export default function PlanReview({order,onSaved}){
 const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=async apply=>{if(busy)return;setBusy(true);setError('');try{const r=await axios.post(`/api/admin/orders/${order.id}/preparation-plan/`,apply?{confirm:preview.confirm}:{},{headers:{'X-CSRFToken':getCookie('csrftoken')}});if(apply){setPreview(null);onSaved()}else setPreview(r.data)}catch(e){setError(apiError(e));if(apply)setPreview(null)}finally{setBusy(false)}};
 return <div className="plan-review"><button disabled={busy} onClick={()=>request(false)}>{busy?'Checking...':'Preview task plan'}</button>{error && <p role="alert">{error}</p>}{preview && <section className="plan-preview"><h3>Review before saving</h3><p>Delivery stays at {when(order.delivery_at)}. Preparation changes from {order.preparation_at?when(order.preparation_at):'not scheduled'} to {when(preview.preview.start)}.</p><ol>{preview.preview.plan.tasks.map((t,i)=><li key={i}><strong>{t.menu}: {t.name}</strong><br/>{when(t.start)} to {when(t.end)}</li>)}</ol><p>Check that this earlier preparation and any waiting time suit your food handling process.</p><div className="admin-toolbar"><button className="admin-primary" disabled={busy} onClick={()=>request(true)}>Use this plan</button><button disabled={busy} onClick={()=>setPreview(null)}>Keep current plan</button></div></section>}</div>;
}
