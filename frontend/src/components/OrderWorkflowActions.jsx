import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import './OrderWorkflowActions.css';

export default function OrderWorkflowActions({order,onSaved}){
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 if(!['pending','processing','cooked','shipped'].includes(order.status))return null;
 const planned=Number.isFinite(Date.parse(order.delivery_at || '')) && Number.isFinite(Date.parse(order.preparation_at || '')) && Number.isFinite(Date.parse(order.preparation_end_at || '')) && Date.parse(order.preparation_end_at)>Date.parse(order.preparation_at) && Date.parse(order.preparation_end_at)<=Date.parse(order.delivery_at) && !order.preparation_plan?.needs_review;
 const preparing=['pending','processing'].includes(order.status);
 const ready=order.status==='cooked';
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
  {order.status==='pending' && planned && <p>This order is already in Planner. Starting preparation is an optional progress update.</p>}
  {order.status==='pending' && !planned?<p>Confirm this order’s preparation plan before starting or marking it ready.</p>:<>
   <div className="planner-progress-buttons">
    <button type="button" className="admin-primary" disabled={!!busy} onClick={()=>update(preparing?'cooked':'delivered',preparing?'ready for delivery':'delivered')}>{busy?(preparing?'Saving preparation…':'Saving delivery…'):preparing?'Mark ready for delivery':'Mark delivered'}</button>
    {order.status==='pending' && <button type="button" disabled={!!busy} onClick={()=>update('processing','preparation started')}>Start preparation (optional)</button>}
    {ready && <button type="button" disabled={!!busy} onClick={()=>update('shipped','out for delivery')}>Out for delivery (optional)</button>}
   </div>
   <p>{preparing?'Mark ready only once the food is prepared. This records ingredient use once, using the accepted recipes and earliest eligible expiry.':'Mark delivered only after the customer receives the order. Payment records are updated separately.'}</p>
  </>}
  {error && <p role="alert">{error}</p>}
 </div>;
}
