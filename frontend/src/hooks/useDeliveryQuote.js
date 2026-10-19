import {useEffect,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {readApiError} from '../utils/apiError';

// Advisory only. Checkout still rechecks capacity and payment under server locks.
export default function useDeliveryQuote({deliveryAt,selectionKey,enabled,issue=''}) {
 const [result,setResult]=useState(null),[attempt,setAttempt]=useState(0);
 const complete=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deliveryAt) && Number.isFinite(Date.parse(deliveryAt+':00+08:00'));
 const canCheck=enabled && complete && !issue;
 useEffect(()=>{
  if(!canCheck)return;
  const controller=new AbortController();
  // Wait for date/time editing to settle; replaced requests cannot update this selection.
  const timer=setTimeout(async()=>{
   setResult({key:selectionKey,attempt,phase:'checking'});
   try {
    const {data}=await axios.post('/api/orders/quote/',{delivery_at:deliveryAt+':00+08:00'},
     {signal:controller.signal,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
    if(controller.signal.aborted)return;
    if(!data || typeof data!=='object' || Array.isArray(data) || (data.needs_review!==true &&
      (!Number.isFinite(Date.parse(data.preparation_at)) || !Number.isFinite(Date.parse(data.preparation_end_at)) || Date.parse(data.preparation_end_at)<=Date.parse(data.preparation_at)))) {
     const error=new Error('Invalid availability response');error.code='INVALID_RESPONSE';throw error;
    }
    setResult({key:selectionKey,attempt,phase:'ready',plan:data});
   } catch(error) {
    if(!controller.signal.aborted)setResult({key:selectionKey,attempt,phase:'error',
     error:error.code==='INVALID_RESPONSE'?'The kitchen returned an unexpected availability response. Please retry.':error.code==='ECONNABORTED'?'The availability check timed out. Please retry; no order was placed.':!error.response?'Could not check delivery availability. Check your connection and retry.':error.response.status>=500?'Delivery availability is temporarily unavailable. Please retry.':readApiError(error,'Review your requested delivery time.'),
     retryable:!error.response || error.response.status>=500});
   }
  },350);
  return()=>{clearTimeout(timer);controller.abort();};
 },[canCheck,deliveryAt,selectionKey,attempt]);
 const current=canCheck && result?.key===selectionKey && result.attempt===attempt;
 return {
  checking:canCheck && (!current || result.phase==='checking'),
  quote:current && result.phase==='ready'?{selectionKey,plan:result.plan}:null,
  error:current && result.phase==='error'?result.error:'',
  retryable:current && result.phase==='error' && result.retryable,
  retry:()=>setAttempt(value=>value+1),
 };
}
