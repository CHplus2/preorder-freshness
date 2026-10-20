import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError,readApiError} from '../utils/apiError';
import {Link} from 'react-router-dom';
import {duration} from '../utils/planner';
const when=d=>new Date(d).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'});
export default function PlanReview({order,onSaved}){
 const [adopt,setAdopt]=useState(false);
 const hasDelivery=Number.isFinite(Date.parse(order.delivery_at || ''));
 const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=async apply=>{
  if(busy)return;
  setBusy(true);setError('');
  try{
   const {data}=await axios.post(`/api/admin/orders/${order.id}/preparation-plan/`,apply?{confirm:preview.confirm,adopt_current:adopt}:{adopt_current:adopt},{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(apply){
    if(data.order?.id!==order.id)throw new Error('The save could not be verified. Refresh Planner before retrying.');
    setPreview(null);onSaved();
   }else{
    if(typeof data.confirm!=='string' || !data.preview?.plan?.tasks?.length || !Number.isFinite(Date.parse(data.preview.start)) || !Number.isFinite(Date.parse(data.preview.end)))throw new Error('The plan could not be read. Please try again.');
    setPreview(data);
   }
  }catch(e){
   const uncertain=apply && (!e.response || e.response.status>=500);
   setError(uncertain?'Confirmation could not be verified. Retry confirmation with this preview, or refresh Planner to check the saved plan.':apply?apiError(e):readApiError(e));
   if(apply && !uncertain)setPreview(null);
  }finally{setBusy(false)}
 };
 return <section className="plan-review" aria-label={`Automatic preparation planning for order ${order.id}`}>
  <h3>{order.preparation_at?'Replan preparation':'Calculate preparation plan'}</h3>
  <p>The kitchen calculates each step’s start and finish around recipes, working hours and existing bookings. You do not need to enter an end time.</p>
  <p className="plan-delivery-note">{hasDelivery?<>Delivery stays at <strong>{when(order.delivery_at)}</strong>. {order.preparation_at?'Existing reservations stay in place until you confirm a replacement.':'No preparation slots are reserved until you confirm a plan.'}</>:<>Set an agreed delivery date through Manage order before calculating preparation.</>}</p>
  <button type="button" className="admin-primary" disabled={busy || !hasDelivery} onClick={()=>request(false)}>{busy?'Calculating…':order.preparation_at?'Calculate new plan':'Calculate plan'}</button>
  <details className="plan-recipe-options"><summary>Recipe settings</summary><label><input type="checkbox" checked={adopt} disabled={busy} onChange={e=>{setAdopt(e.target.checked);setPreview(null);setError('')}}/> Use current recipe and preparation settings</label><p>By default, keep the settings accepted with this order. Agree ingredient changes with the customer before using an updated recipe.</p></details>
  {error && <div className="plan-calculation-error" role="alert"><strong>Preparation plan needs attention</strong><p>{error}</p><p>If this delivery cannot fit, agree a later delivery time or review a manual arrangement below. A workable new time can be confirmed with its preparation plan; an unscheduled request still needs kitchen confirmation.</p><Link className="text-link" to={'/admin/orders?order='+order.id}>Review delivery time for order #{order.id}</Link></div>}
  {preview && <section className="plan-preview"><h4>Review calculated plan</h4><dl className="plan-calculated-times"><div><dt>Preparation starts</dt><dd>{when(preview.preview.start)}</dd></div><div><dt>Food ready</dt><dd>{when(preview.preview.end)}</dd></div><div><dt>Start to finish</dt><dd>{duration((Date.parse(preview.preview.end)-Date.parse(preview.preview.start))/60000)}</dd></div></dl><p>All times are Malaysia time. Check preparation, storage and waiting times before confirming. Delivery and payment stay unchanged.</p><ul>{preview.preview.recipes?.map(r=><li key={r.item}>{r.menu}: {r.ingredients.map(i=>`${i.quantity} ${i.unit} ${i.name} per portion`).join(', ')} · packaging RM {r.packaging ?? 'unknown'} per portion</li>)}</ul><details className="plan-calculated-steps"><summary>View {preview.preview.plan.tasks.length} preparation steps</summary><ol>{preview.preview.plan.tasks.map((t,i)=><li key={i}><strong>{t.menu}: {t.name}</strong><br/>{when(t.start)} to {when(t.end)}</li>)}</ol></details><div className="admin-toolbar"><button type="button" className="admin-primary" disabled={busy} onClick={()=>request(true)}>Confirm preparation plan</button><button type="button" disabled={busy} onClick={()=>setPreview(null)}>Discard preview</button></div></section>}
 </section>;
}
