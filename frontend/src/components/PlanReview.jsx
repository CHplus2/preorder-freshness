import {handoverLabel} from '../utils/fulfilment';
import {useId,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError,readApiError} from '../utils/apiError';
import {duration} from '../utils/planner';
import {deliveryInput} from '../utils/deliverySlots';
import {guideDateBounds} from '../utils/guidePresentation';
import './PlanReview.css';
const when=d=>new Date(d).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'});
export default function PlanReview({order,onSaved}){
 const [openedAt]=useState(()=>Date.now());
 const [adopt,setAdopt]=useState(false),[agreed,setAgreed]=useState(false);
 const [delivery,setDelivery]=useState(()=>Date.parse(order.delivery_at || '')>openedAt?deliveryInput(order.delivery_at):'');
 const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState(null),[saved,setSaved]=useState(false);
 const handover=handoverLabel(order),open=String(order.fulfilment_snapshot?.open_hour ?? 9).padStart(2,'0'),close=String(order.fulfilment_snapshot?.close_hour ?? 21).padStart(2,'0');
 const inputId=useId(),bounds=guideDateBounds(new Date(openedAt));
 const deliveryChanged=preview && Date.parse(preview.preview.delivery_at)!==Date.parse(order.delivery_at || '');
 const reset=()=>{setPreview(null);setAgreed(false);setError('');setSearch(null);setSaved(false)};
 const request=async(apply=false,findNext=false)=>{
  if(busy || (apply && deliveryChanged && !agreed))return;
  if(!apply && !findNext && !delivery){setError('Choose a delivery time, or let the kitchen find the next available time.');return;}
  setBusy(true);setError('');
  if(!apply){setPreview(null);setAgreed(false);setSearch(null);}
  try{
   const body=apply?{confirm:preview.confirm}:{adopt_current:adopt,order_version:order.updated_at,
    reason:'Delivery arrangement agreed with the customer during preparation planning.',
    ...(findNext?{find_next:true,search_from:delivery.slice(0,10) || bounds.first}:{delivery_at:delivery+':00+08:00'})};
   const {data}=await axios.post(`/api/admin/orders/${order.id}/preparation-plan/`,body,{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(apply){
    if(data.order?.id!==order.id)throw new Error('The save could not be verified. Refresh before retrying.');
    setPreview(null);setSaved(true);
    try{await onSaved?.('Delivery and preparation plan confirmed.');}
    catch{setError('The plan was saved, but the latest order could not be loaded. Refresh to see it.');}
   }else if(data.preview===null && typeof data.search?.reason==='string'){
    setSearch(data.search);
   }else{
    if(typeof data.confirm!=='string' || !data.preview?.plan?.tasks?.length || ![data.preview.start,data.preview.end,data.preview.delivery_at].every(value=>Number.isFinite(Date.parse(value))))throw new Error('The plan could not be read. Please try again.');
    setPreview(data);setDelivery(deliveryInput(data.preview.delivery_at));
   }
  }catch(e){
   const uncertain=apply && (!e.response || e.response.status>=500);
   setError(uncertain?'Confirmation could not be verified. Retry with this preview, or refresh to check the saved plan.':apply?apiError(e):readApiError(e));
   if(apply && !uncertain)setPreview(null);
  }finally{setBusy(false)}
 };
 return <section className="plan-review" aria-label={`Delivery and preparation for order ${order.id}`} aria-busy={busy}>
  <h3>{order.preparation_at?`Update ${handover.toLowerCase()} & preparation`:`Plan ${handover.toLowerCase()} & preparation`}</h3>
  {!preview && <p>Choose {handover.toLowerCase()} or find a workable time. We calculate the preparation around recipes, kitchen hours and bookings. You do not need to enter an end time.</p>}
  {!preview && <p className="plan-delivery-note">{order.preparation_at?'Your saved reservation stays in place until a replacement is confirmed.':'No preparation slots are reserved until you confirm a plan.'} All times are Malaysia time.</p>}
  {saved?<p role="status">Delivery and preparation plan confirmed.</p>:<>
  {!preview && <form onSubmit={event=>{event.preventDefault();request()}}>
   {Date.parse(order.delivery_at || '')<=openedAt && <p>The saved delivery time has passed. Choose a future time or find one below.</p>}
   <label htmlFor={inputId}>{handover} date and time<input id={inputId} type="datetime-local" min={bounds.first+'T'+open+':00'} max={bounds.last+'T'+close+':00'} required disabled={busy} value={delivery} onChange={event=>{setDelivery(event.target.value);reset()}}/></label>
   <div className="plan-primary-actions"><button type="submit" className={delivery?'admin-primary':''} disabled={busy}>{busy?'Checking kitchen…':'Preview preparation plan'}</button><button type="button" className={!delivery?'admin-primary':''} disabled={busy} onClick={()=>request(false,true)}>Find next available time</button></div>
   <p className="plan-search-hint">Search checks hourly delivery times over the next seven days from your chosen date, within the 90-day booking window.</p>
   <details className="plan-recipe-options"><summary>Recipe settings</summary><label><input type="checkbox" checked={adopt} disabled={busy} onChange={e=>{setAdopt(e.target.checked);reset()}}/> Use current recipe and preparation settings</label><p>Keep the accepted settings by default. Agree ingredient changes with the customer before using an updated recipe.</p></details>
  </form>}
  {busy && <p role="status">{preview?'Confirming your plan…':'Checking preparation and delivery together…'}</p>}
  {error && <div className="plan-calculation-error" role="alert"><strong>{preview?'Confirmation needs attention':'No plan confirmed'}</strong><p>{error}</p>{!preview && <p>Use Find next available time to check later dates. Recipe and kitchen limits stay in force.</p>}<button type="button" disabled={busy} onClick={()=>onSaved?.()}>Refresh latest order</button></div>}
  {search && <div className="plan-search-empty" role="status"><strong>No automatic plan found</strong><p>Checked {search.from_date}–{search.through_date}. Try the following week or review the menu preparation settings.</p><details><summary>Why the plan needs review</summary><p>{search.reason}</p></details></div>}
  {preview && <section className="plan-preview"><h4>Review delivery & preparation</h4><dl className="plan-calculated-times"><div><dt>{deliveryChanged?'New delivery':'Delivery'}</dt><dd>{when(preview.preview.delivery_at)}</dd></div><div><dt>Preparation starts</dt><dd>{when(preview.preview.start)}</dd></div><div><dt>Food ready</dt><dd>{when(preview.preview.end)}</dd></div><div><dt>Start to finish</dt><dd>{duration((Date.parse(preview.preview.end)-Date.parse(preview.preview.start))/60000)}</dd></div></dl>
   {deliveryChanged && <><p>Previous delivery: {Number.isFinite(Date.parse(order.delivery_at || ''))?when(order.delivery_at):'Not set'}. The new time and preparation slots will be saved together.</p><label className="plan-agreement"><input type="checkbox" checked={agreed} disabled={busy} onChange={event=>setAgreed(event.target.checked)}/> I have agreed this delivery time with the customer.</label></>}
   <p>Review cooking, storage and waiting times. This preview expires after 10 minutes; availability is checked again when confirmed. Payment and order totals stay unchanged.</p>
   {preview.preview.recipes?.length>0 && <details><summary>Updated recipes to accept</summary><ul>{preview.preview.recipes.map(r=><li key={r.item}>{r.menu}: {r.ingredients.map(i=>`${i.quantity} ${i.unit} ${i.name} per portion`).join(', ')} · packaging RM {r.packaging ?? 'unknown'} per portion</li>)}</ul></details>}
   <details className="plan-calculated-steps"><summary>View {preview.preview.plan.tasks.length} preparation steps</summary><ol>{preview.preview.plan.tasks.map((t,i)=><li key={i}><strong>{t.menu}: {t.name}</strong><br/>{when(t.start)} to {when(t.end)}</li>)}</ol></details><div className="plan-primary-actions"><button type="button" className="admin-primary" disabled={busy || (deliveryChanged && !agreed)} onClick={()=>request(true)}>{busy?'Confirming…':deliveryChanged?'Confirm delivery & plan':'Confirm preparation plan'}</button><button type="button" disabled={busy} onClick={reset}>Change time</button></div>
  </section>}
  </>}
 </section>;
}
