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

function SlotSearch({day,onSelect,disabled=false,nextDisabled=disabled,selectedValue=''}){
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
  {!day && <p id={hintId}>Choose a date, or leave it blank to find the earliest available day for your basket.</p>}
  <div className="basket-slot-actions"><button type="button" className="basket-next-day" disabled={!!busy || nextDisabled} aria-describedby={!day?hintId:undefined} onClick={()=>check(!day || disabled)}>{busy?'Finding times…':'Find delivery times'}</button></div>
  {busy && <p role="status">{busy==='next'?'Checking up to seven days after the menu’s advance notice, using kitchen capacity and preparation rules…':'Checking preparation time, existing bookings and menu delivery rules…'}</p>}
  {!nextDisabled && error && <p role="alert">{error}</p>}
  {result && !nextDisabled && (result.next || !disabled) && (result.slots.length===0?<div role="status" className="basket-slot-empty"><strong>{result.timingConflict?'These menus need a timing review.':result.next?'No hourly suggestions found in this search.':'No hourly suggestions found for this date.'}</strong>{!result.timingConflict && result.next && result.from && result.through && <p>Checked {dateLabel(result.from)} to {dateLabel(result.through)}.</p>}{result.reason && <p>{result.reason}</p>}<p>{result.timingConflict?'You can request a time at checkout for the kitchen to review. This does not reserve a preparation slot.':<>{result.next?'Change the date or quantities, or send a request at checkout for the kitchen to review.':'Try later dates, or request this time at checkout for the kitchen to review.'}</>}</p>{!result.next && !result.timingConflict && <button type="button" disabled={!!busy || nextDisabled} onClick={()=>check(true)}>Search later dates</button>}</div>:<><p role="status" className="basket-found-date">{result.date && <strong>Suggested for {dateLabel(result.date)}</strong>}Choose one time. We’ll check it automatically at checkout.</p><div className="slot-suggestions">{result.slots.map(s=><button type="button" disabled={!!busy || nextDisabled} key={s.delivery_at} aria-pressed={selectedValue===new Date(Date.parse(s.delivery_at)+8*3600000).toISOString().slice(0,16)} onClick={()=>onSelect(new Date(Date.parse(s.delivery_at)+8*3600000).toISOString().slice(0,16))}>{new Date(s.delivery_at).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'})}</button>)}</div></>)}
 </div>;
}
