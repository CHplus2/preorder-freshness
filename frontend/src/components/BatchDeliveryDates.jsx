import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {deliveryDatePreview,deliveryDateConfirmation} from '../utils/deliveryDateBatch';
import {useUI} from '../contexts/UIContext';
const when=value=>new Date(value).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'});
const url='/api/admin/orders/missing-delivery-dates/';
export default function BatchDeliveryDates({onSaved}){
 const [preview,setPreview]=useState(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 const {setAlert}=useUI() || {};
 async function request(apply){
  if(busy || apply && (!preview || !confirmed))return;
  setBusy(true);setError('');
  try{
   const {data}=await axios.post(url,apply?{confirm:preview.confirm,confirm_fictional:true}:{},{timeout:60000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(apply){
    const saved=deliveryDateConfirmation(data,preview.proposed_dates.map(row=>row.order_id));
    setResult(saved);setPreview(null);setConfirmed(false);
    setAlert?.({type:'success',message:`Delivery dates saved for ${saved.updated_order_ids.length} demo requests. Preparation still needs review.`});
    try{await onSaved();}catch{setError('Delivery dates were saved, but Planner could not refresh. Use Refresh above to load the saved records.');}
   }else{setPreview(deliveryDatePreview(data));setConfirmed(false);setResult(null);}
  }catch(e){setError(apiError(e));if(e.response?.status<500){setPreview(null);setConfirmed(false);}}
  finally{setBusy(false);}
 }
 return <section className="batch-delivery-dates" aria-label="Assign demo delivery dates">
  {!preview && !result && <><button type="button" disabled={busy} onClick={()=>request(false)}>{busy?'Finding dates…':'Suggest delivery dates for demo orders'}</button><p>Propose future dates for these fictional requests together, using menu delivery days, lead times and daily limits.</p></>}
  {busy && <p role="status">{preview?'Saving the reviewed dates…':'Checking open requests and available delivery dates…'}</p>}
  {error && <p role="alert">{error}</p>}
  {result && <p role="status">{result.updated_order_ids.length} delivery dates saved. {result.remaining_missing_dates} open records still have no date. Review preparation plans before starting work.</p>}
  {preview && <div className="batch-delivery-preview">
   <h3>Review {preview.proposed_dates.length} proposed delivery dates</h3><p>{preview.note}</p>
   {preview.proposed_dates.length>0 ? <><div className="batch-delivery-table"><table><caption>Fictional requests · Malaysia time · nothing saved yet</caption><thead><tr><th>Order</th><th>Menus</th><th>Proposed delivery</th></tr></thead><tbody>{preview.proposed_dates.map(row=><tr key={row.order_id}><th scope="row">#{row.order_id}</th><td>{row.menus.map(menu=>`${menu.quantity} × ${menu.name}`).join(', ')}<small>Payment stays {row.payment_status}</small></td><td>{when(row.delivery_at)}</td></tr>)}</tbody></table></div>
    <label className="batch-delivery-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>These are fictional demo requests; use the proposed future dates.</label>
    <p>Dates only: no payment, delivery completion, accepted recipe or stock changes. Preparation still needs review.</p>
    <button type="button" disabled={busy || !confirmed} onClick={()=>request(true)}>{busy?'Saving dates…':`Set ${preview.proposed_dates.length} demo delivery dates`}</button>
   </> : <p>No eligible requests could be assigned dates automatically. Review the reasons below.</p>}
   <button type="button" disabled={busy} onClick={()=>{setPreview(null);setConfirmed(false)}}>Close preview</button>
   {preview.skipped.length>0 && <div><h4>{preview.skipped.length} requests need individual review</h4><ul>{preview.skipped.map(row=><li key={row.order_id}>Order #{row.order_id}: {row.reason}</li>)}</ul></div>}
  </div>}
 </section>;
}
