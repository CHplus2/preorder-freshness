import {useState} from 'react';
import axios from 'axios';
import {orderEmailPreference} from '../utils/orderEmail';
import DeliveryEmailChoice from './DeliveryEmailChoice';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';

export default function OrderEmailReminder({order,contact,onSaved}){
 const [now]=useState(()=>Date.now());
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(null),[pending,setPending]=useState(null),[pendingUpdates,setPendingUpdates]=useState(null),[pendingTime,setPendingTime]=useState(null);
 if(['delivered','cancelled'].includes(order.status))return null;
 const future=Number.isFinite(Date.parse(order.delivery_at)) && Date.parse(order.delivery_at)>now;
 const preference=saved || order.fulfilment_snapshot?.customer_reminder;
 const enabled=preference?.enabled===true && preference.email?.toLowerCase()===contact?.email?.toLowerCase();
 if(!future && !enabled)return null;
 const change=async (value,updates=preference?.dispatch_updates===true,times=preference?.time_updates===true)=>{
  if(busy)return;
  setBusy(true);setPending(value);setPendingUpdates(updates);setPendingTime(times);setError('');
  try{
   const {data}=await axios.post(`/api/orders/${order.id}/reminder/`,{enabled:value,dispatch_updates:value && updates,time_updates:value && times},{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   setSaved(orderEmailPreference(data));onSaved?.();
  }catch(error){setError(!error.response || error.response.status>=500 || error.code==='INVALID_RESPONSE'?'We could not confirm this reminder setting. Refresh order status to check it, or try again.':apiError(error));}finally{setBusy(false);setPending(null);setPendingUpdates(null);setPendingTime(null);}
 };
 return <div className="order-email-reminder"><DeliveryEmailChoice contact={contact} checked={pending ?? enabled} onChange={change} dispatchUpdates={pendingUpdates ?? preference?.dispatch_updates===true} onDispatchChange={order.delivery_method==='pickup' || !future?undefined:value=>change(true,value)} timeUpdates={pendingTime ?? preference?.time_updates===true} onTimeChange={value=>change(true,preference?.dispatch_updates===true,value)} disabled={busy} id={`reminder-${order.id}`}/>{enabled && order.preparation_plan?.needs_review && <p>The reminder waits for kitchen confirmation of a workable preparation plan.</p>}{!future && <p>The agreed time has passed. You can turn off existing emails here; contact the kitchen about current delivery arrangements.</p>}{error && <p role="alert">{error}</p>}</div>;
}
