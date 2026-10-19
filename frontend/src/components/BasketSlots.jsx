import {responseSlots} from '../utils/apiResponse';
import {useEffect,useId,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {readApiError} from '../utils/apiError';

export default function BasketSlots({value='',...props}){
 const day=value.slice(0,10);
 // A different date is a new search: old errors, choices and pending replies
 // must never describe availability for the newly selected day.
 return <SlotSearch key={day} day={day} {...props}/>;
}

function SlotSearch({day,onSelect,disabled=false}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef(null);
 const hintId=useId();
 useEffect(()=>()=>request.current?.abort(),[]);
 const check=async()=>{
  if(!day || busy || disabled)return;
  const controller=new AbortController();request.current=controller;
  setBusy(true);setError('');setResult(null);
  try{
   const r=await axios.post('/api/orders/slots/',{date:day},{signal:controller.signal,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(controller.signal.aborted)return;
   setResult({slots:responseSlots(r.data),reason:typeof r.data.unavailable_reason==='string'?r.data.unavailable_reason:''});
  }catch(e){
   if(!controller.signal.aborted)setError(e.code==='ECONNABORTED'?'Finding delivery times took too long. Try again, or request a time at checkout for the owner to review.':readApiError(e,'Delivery times could not be checked.'));
  }finally{if(!controller.signal.aborted)setBusy(false);}
 };
 return <div className="basket-slot-search">
  {!day && <p id={hintId}>Choose a delivery date above, then ask us to find a time for your whole basket.</p>}
  <button type="button" disabled={!day || busy || disabled} aria-describedby={!day?hintId:undefined} onClick={check}>{busy?'Finding times…':'Suggest times for this basket'}</button>
  {busy && <p role="status">Checking preparation time, existing bookings and menu delivery rules…</p>}
  {!disabled && error && <p role="alert">{error}</p>}
  {!disabled && result && (result.slots.length===0?<div role="status" className="basket-slot-empty"><strong>No hourly suggestions found for this date.</strong>{result.reason && <p>{result.reason}</p>}<p>Try a later date or fewer portions. You can also request a delivery time at checkout for the owner to review; it is not confirmed until accepted.</p></div>:<><p role="status">Choose a suggested time below. Availability is checked again when you order.</p><div className="slot-suggestions">{result.slots.map(s=><button type="button" key={s.delivery_at} onClick={()=>onSelect(new Date(Date.parse(s.delivery_at)+8*3600000).toISOString().slice(0,16))}>{new Date(s.delivery_at).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'})}</button>)}</div></>)}
 </div>;
}
