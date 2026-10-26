import {useState} from 'react';
import axios from 'axios';
import {orderEmailPreference} from '../utils/orderEmail';
import DeliveryEmailChoice from './DeliveryEmailChoice';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';

export default function OrderEmailReminder({order,contact,onSaved}){
 const [now]=useState(()=>Date.now());
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(null),[pending,setPending]=useState(null);
 if(!order.delivery_at || Date.parse(order.delivery_at)<=now || ['delivered','cancelled'].includes(order.status))return null;
 const preference=saved || order.fulfilment_snapshot?.customer_reminder;
 const enabled=preference?.enabled===true && preference.email?.toLowerCase()===contact?.email?.toLowerCase();
 const change=async value=>{
  if(busy)return;
  setBusy(true);setPending(value);setError('');
  try{
   const {data}=await axios.post(`/api/orders/${order.id}/reminder/`,{enabled:value},{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   setSaved(orderEmailPreference(data));onSaved?.();
  }catch(error){setError(!error.response || error.response.status>=500 || error.code==='INVALID_RESPONSE'?'We could not confirm this reminder setting. Refresh order status to check it, or try again.':apiError(error));}finally{setBusy(false);setPending(null);}
 };
 return <div className="order-email-reminder"><DeliveryEmailChoice contact={contact} checked={pending ?? enabled} onChange={change} disabled={busy} id={`reminder-${order.id}`}/>{enabled && order.preparation_plan?.needs_review && <p>The reminder waits for kitchen confirmation of a workable preparation plan.</p>}{error && <p role="alert">{error}</p>}</div>;
}
