import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {arrivalLabel} from '../utils/arrivalWindow';
import {progressChoices,batchEligible,validateBatchResult} from '../utils/orderBatchProgress';
import './OrderProgressBatch.css';

export default function OrderProgressBatch({orders,onSaved}){
 const [target,setTarget]=useState(''),[selected,setSelected]=useState([]),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const choice=progressChoices.find(row=>row.status===target);
 const candidates=orders.filter(order=>batchEligible(order,target));
 const changed=selected.some(row=>!candidates.some(order=>order.id===row.id && order.updated_at===row.version));
 const unpaid=candidates.filter(order=>selected.some(row=>row.id===order.id) && order.payment_status!=='paid').length;
 function choose(status){setTarget(status);setSelected([]);setReview(false);setError('');}
 function toggle(order){
  setReview(false);setError('');
  setSelected(rows=>rows.some(row=>row.id===order.id)?rows.filter(row=>row.id!==order.id):[...rows,{id:order.id,version:order.updated_at}]);
 }
 async function save(){
  if(busy || uncertain || changed || !review || !selected.length || selected.length>20)return;
  setBusy(true);setError('');
  try{
   const {data}=await axios.post('/api/admin/orders/progress/',{status:target,orders:selected},{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   validateBatchResult(data,selected,target);
   const notice=`${selected.length} ${selected.length===1?'order':'orders'} updated: ${choice.label.toLowerCase()}.`;
   setSelected([]);setReview(false);onSaved?.(notice);
  }catch(e){
   if(!e.response || e.response.status>=500){setUncertain(true);setError('The result could not be confirmed. Refresh Planner before making another update; do not assume the selected orders stayed unchanged.');}
   else {setError(apiError(e));if(e.response.status===409 || e.response.status===404)setUncertain(true);}
  }finally{setBusy(false);}
 }
 return <section className="order-batch-progress" aria-label="Update several orders">
  <h3>Update several orders</h3><p>Confirm what has actually happened. Planned times never advance an order automatically.</p>
  <div className="order-batch-choices" role="group" aria-label="Actual order progress">{progressChoices.map(row=><button type="button" key={row.status} disabled={busy || uncertain} aria-pressed={target===row.status} onClick={()=>choose(row.status)}>{row.label}</button>)}</div>
  {choice && <><p>{choice.note}</p>{candidates.length===0?<p>No eligible orders for this update on the selected day. Requests without confirmed preparation need review first.</p>:<fieldset disabled={busy || uncertain}><legend>Select up to 20 orders · {selected.length} selected</legend><button type="button" onClick={()=>{setSelected(candidates.slice(0,20).map(order=>({id:order.id,version:order.updated_at})));setReview(false);setError('');}}>{candidates.length>20?'Select first 20 eligible orders':'Select eligible orders'}</button>{candidates.map(order=><label className="order-batch-row" key={order.id}><input type="checkbox" checked={selected.some(row=>row.id===order.id)} disabled={selected.length>=20 && !selected.some(row=>row.id===order.id)} onChange={()=>toggle(order)}/><span><strong>Order #{order.id} · {order.delivery_method==='pickup'?'Collection':'Delivery'}</strong><span>{arrivalLabel(order)} · {order.items?.map(item=>item.product_name).join(', ') || 'Review order items'}</span><small>Payment: {order.payment_status || 'review records'}</small></span></label>)}</fieldset>}
   {changed && <p role="alert">A selected order changed. Clear the selection and review the latest records.</p>}
   {selected.length>0 && <div className="order-batch-confirm">
    {!review?<button type="button" className="admin-primary" disabled={busy || uncertain || changed} onClick={()=>setReview(true)}>Review {selected.length} selected {selected.length===1?'order':'orders'}</button>:<div role="group" aria-label="Confirm selected order progress"><strong>{choice.label}: {selected.map(row=>'#'+row.id).join(', ')}</strong><p>{choice.note} All selected updates are saved together; if one cannot be saved, none are applied.</p>{unpaid>0 && <p>{unpaid} selected {unpaid===1?'order is':'orders are'} not recorded as paid. This action does not collect payment or mark an order paid.</p>}<button type="button" className="admin-primary" disabled={busy || uncertain || changed} onClick={save}>{busy?'Saving…':`${choice.confirm} for ${selected.length} ${selected.length===1?'order':'orders'}`}</button></div>}
    <button type="button" disabled={busy} onClick={()=>{setSelected([]);setReview(false);}}>Clear selection</button>
   </div>}
  </>}
  {error && <p role="alert">{error}</p>}{uncertain && <button type="button" onClick={()=>onSaved?.()}>Refresh Planner</button>}
 </section>;
}
