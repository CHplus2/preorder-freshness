import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {hasPreparationPlan} from '../utils/orderBatchProgress';
import './OrderWorkflowActions.css';

export default function OrderWorkflowActions({order,onSaved,compact=false}){
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 if(!['pending','processing','cooked','shipped'].includes(order.status))return null;
 const planned=hasPreparationPlan(order);
 const preparing=['pending','processing'].includes(order.status);
 const ready=order.status==='cooked';
 const pickup=order.delivery_method==='pickup';
 const update=async(target,label)=>{
  if(busy)return;
  setBusy(target);setError('');
  try{
   const {data}=await axios.patch(`/api/admin/orders/${order.id}/`,{status:target},{headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(data.order?.id!==order.id || data.order.status!==target)throw new Error('Unexpected order response');
   onSaved?.(`Order #${order.id}: ${label}.`);
  }catch(e){setError(!e.response || e.response.status>=500?'The update could not be confirmed. Refresh Planner before trying again.':apiError(e));}
  finally{setBusy('');}
 };
 return <div className="planner-progress-actions" aria-label={`Progress for order ${order.id}`}>
  {!compact && order.status==='pending' && planned && <p>Already scheduled. Tracking the preparation start is optional.</p>}
  {!compact && ready && <p>Food is ready for handover. Dispatch tracking is optional.</p>}
  {!compact && order.status==='shipped' && <p>Out for delivery. Confirm delivery once the customer receives the order.</p>}
  {preparing && !planned?<p>Confirm this order’s preparation plan before starting or marking it ready.</p>:<>
   <div className="planner-progress-buttons">
    <button type="button" className="admin-primary" disabled={!!busy} onClick={()=>update(preparing?'cooked':ready && !pickup?'shipped':'delivered',preparing?'food ready':ready && !pickup?'handed to courier':pickup?'collected':'delivered')}>{busy?'Saving…':preparing?'Mark food ready':ready && !pickup?'Handed to courier':pickup?'Mark collected':'Mark delivered'}</button>
    {!compact && order.status==='pending' && <button type="button" disabled={!!busy} onClick={()=>update('processing','preparation started')}>Mark preparation started (optional)</button>}
    {ready && !pickup && <button type="button" disabled={!!busy} onClick={()=>update('delivered','delivered')}>Mark delivered directly</button>}
   </div>
   {!compact && <p>{preparing?'Mark ready after cooking. This deducts ingredients once, using accepted recipes and earliest eligible expiry. Starting preparation does not deduct stock.':pickup?'Mark collected only after handing the order to the customer. Payment records are updated separately.':ready?'Record courier handover when food leaves. Mark delivered directly only after the customer receives it. Payment records are updated separately.':'Mark delivered only after the customer receives the order. Payment records are updated separately.'}</p>}
  </>}
  {error && <p role="alert">{error}</p>}
 </div>;
}
