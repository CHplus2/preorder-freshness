import {responseSlots} from '../utils/apiResponse';
import {useEffect,useId,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {readApiError} from '../utils/apiError';
import './BasketSlots.css';

const dateLabel=value=>new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',weekday:'short',day:'numeric',month:'short',year:'numeric'});

export default function BasketSlots({value='',...props}){
 const day=value.slice(0,10);
 // A different date is a new search: old errors, choices and pending replies
 // must never describe availability for the newly selected day.
 return <SlotSearch key={day} day={day} {...props}/>;
}

function SlotSearch({day,onSelect,disabled=false,nextDisabled=disabled}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const request=useRef(null);
 const hintId=useId();
 useEffect(()=>()=>request.current?.abort(),[]);
 const check=async(findNext=false)=>{
  if(busy || (findNext?nextDisabled:!day || disabled))return;
  const controller=new AbortController();request.current=controller;
  setBusy(findNext?'next':'date');setError('');setResult(null);
  try{
   const r=await axios.post('/api/orders/slots/',{...(day?{date:day}:{}),...(findNext?{find_next:true}:{})},{signal:controller.signal,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(controller.signal.aborted)return;
   const slots=responseSlots(r.data);
   const suggested=typeof r.data.suggested_date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(r.data.suggested_date)?r.data.suggested_date:'';
   const from=typeof r.data.searched_from==='string' && /^\d{4}-\d{2}-\d{2}$/.test(r.data.searched_from)?r.data.searched_from:'';
   const through=typeof r.data.searched_through==='string' && /^\d{4}-\d{2}-\d{2}$/.test(r.data.searched_through)?r.data.searched_through:'';
   setResult({slots,date:suggested,from,through,next:findNext,timingConflict:r.data.unavailable_code==='simultaneous_finish',reason:typeof r.data.unavailable_reason==='string'?r.data.unavailable_reason:''});
  }catch(e){
   if(!controller.signal.aborted)setError(e.code==='ECONNABORTED'?'Finding delivery times took too long. Try again, or request a time at checkout for the owner to review.':readApiError(e,'Delivery times could not be checked.'));
  }finally{if(!controller.signal.aborted)setBusy('');}
 };
 return <div className="basket-slot-search">
  {!day && <p id={hintId}>Choose a preferred date, or let us search upcoming days for your whole basket.</p>}
  <div className="basket-slot-actions"><button type="button" disabled={!day || !!busy || disabled} aria-describedby={!day?hintId:undefined} onClick={()=>check(false)}>{busy==='date'?'Finding times…':'Suggest times for this basket'}</button><button type="button" className="basket-next-day" disabled={!!busy || nextDisabled} onClick={()=>check(true)}>{busy==='next'?'Searching upcoming days…':'Find the next available day'}</button></div>
  {busy && <p role="status">{busy==='next'?'Checking up to seven days after the menu’s advance notice, using kitchen capacity and preparation rules…':'Checking preparation time, existing bookings and menu delivery rules…'}</p>}
  {!nextDisabled && error && <p role="alert">{error}</p>}
  {result && !nextDisabled && (result.next || !disabled) && (result.slots.length===0?<div role="status" className="basket-slot-empty"><strong>{result.timingConflict?'These menus need a timing review.':result.next?'No hourly suggestions found in this search.':'No hourly suggestions found for this date.'}</strong>{!result.timingConflict && result.next && result.from && result.through && <p>Checked {dateLabel(result.from)} to {dateLabel(result.through)}.</p>}{result.reason && <p>{result.reason}</p>}<p>{result.timingConflict?'You can request a time at checkout for the kitchen to review. This does not reserve a preparation slot.':<>{result.next?'Review the quantities and menu rules, or contact the kitchen about another arrangement.':'Use “Find the next available day” to check later dates automatically.'} A request at checkout still needs the owner’s review when no automatic plan fits.</>}</p></div>:<><p role="status" className="basket-found-date">{result.date && <strong>Suggested for {dateLabel(result.date)}</strong>}Choose a time below. Availability is checked again when you order.</p><div className="slot-suggestions">{result.slots.map(s=><button type="button" disabled={!!busy || nextDisabled} key={s.delivery_at} onClick={()=>onSelect(new Date(Date.parse(s.delivery_at)+8*3600000).toISOString().slice(0,16))}>{new Date(s.delivery_at).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'})}</button>)}</div></>)}
 </div>;
}
