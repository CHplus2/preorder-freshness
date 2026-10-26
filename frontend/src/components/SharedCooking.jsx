import {useEffect,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {orderDate} from '../utils/orderPresentation';
import {duration} from '../utils/planner';
import './SharedCooking.css';

export default function SharedCooking({date,onSaved}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(null),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();axios.get('/api/admin/shared-cooking/',{params:{date},signal:controller.signal}).then(({data})=>{if(!Array.isArray(data.candidates) || !Array.isArray(data.shared))throw new Error('Invalid batch response');setData(data);setError('');}).catch(e=>{if(!axios.isCancel(e))setError(apiError(e));});return()=>controller.abort();},[date,retry]);
 const calculate=async(selection,confirm)=>{
  if(busy)return;setBusy(true);setError('');
  try{const {data}=await axios.post('/api/admin/shared-cooking/',{...selection,...(confirm?{confirm}: {})},{headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(confirm){if(data.applied!==true)throw new Error('Apply not confirmed');setPreview(null);setRetry(n=>n+1);onSaved?.('Shared cooking updated. Customer orders and payment records are unchanged.');}
   else{if(typeof data.confirm!=='string' || !Array.isArray(data.preview?.plans))throw new Error('Invalid preview');setPreview({...data,selection});}
  }catch(e){setError(apiError(e,'The batch update could not be confirmed. Refresh before retrying.'));setPreview(null);}finally{setBusy(false);}
 };
 return <section className="shared-cooking"><h2>Shared cooking</h2><p>Combine matching single-menu orders for the same delivery time into one cooking reservation. Accepted recipes, preparation settings and dispatch buffers must match. Each customer keeps their own order, ingredients, payment and handover.</p><p>Only future, confirmed orders that have not started are eligible. A preview checks the whole kitchen before you confirm; no holding or working-hour limit is relaxed.</p>{error && <p role="alert">{error} <button disabled={busy} onClick={()=>setRetry(n=>n+1)}>Refresh batches</button></p>}
 {!data && !error && <p role="status">Checking compatible orders…</p>}
 {data && <><h3>Compatible orders</h3>{!data.candidates.length && <p>No matching orders on this date. Different menus, times or accepted settings stay separate.</p>}{data.candidates.map(group=><article key={group.order_ids.join('-')} className="shared-cooking-choice"><h4>{group.menu} · {group.quantity} selling units</h4><p>{group.order_ids.map(id=>'#'+id).join(', ')} · {orderDate(group.delivery_at)}</p><button disabled={busy} onClick={()=>calculate({order_ids:group.order_ids,mode:'combine'})}>Preview shared plan</button></article>)}<h3>Shared reservations</h3>{!data.shared.length && <p>No shared cooking reservations on this date.</p>}{data.shared.map(group=><article key={group.id} className="shared-cooking-choice"><h4>{group.menu}</h4><p>{group.order_ids.map(id=>'#'+id).join(', ')} · {orderDate(group.delivery_at)}</p><button disabled={busy} onClick={()=>calculate({order_ids:group.order_ids,mode:'separate'})}>Preview separate plans</button></article>)}</>}
 {preview && <section className="shared-cooking-preview" aria-label="Shared cooking preview"><h3>{preview.selection.mode==='combine'?'Confirm shared cooking':'Confirm separate cooking'}</h3><p>Hands-on reservation: {duration(preview.preview.previous_hands_on_minutes)} currently → {duration(preview.preview.hands_on_minutes)} proposed. Delivery times and ingredient quantities stay unchanged.</p><ul>{preview.preview.plans.map(plan=><li key={plan.order_id}>#{plan.order_id}: {orderDate(plan.start)} to {orderDate(plan.end)} · {plan.task_count} {plan.task_count===1?'step':'steps'}</li>)}</ul>{preview.selection.mode==='combine' && <p>These orders will reference one set of cooking steps; the daily agenda counts the work once.</p>}<details><summary>Review proposed cooking steps</summary><ol>{(preview.preview.tasks || []).map((task,index)=><li key={index}><strong>{task.name}</strong> · {task.resource.replaceAll('_',' ')} · {orderDate(task.start)} to {orderDate(task.end)}</li>)}</ol></details><p>Confirm within 10 minutes. Changes are checked again. Separating a batch requires room for every independent plan; if it cannot fit, the shared reservation stays intact.</p><button disabled={busy} onClick={()=>calculate(preview.selection,preview.confirm)}>{busy?'Saving…':'Confirm preparation reservations'}</button><button disabled={busy} onClick={()=>setPreview(null)}>Back</button></section>}
 </section>;
}
