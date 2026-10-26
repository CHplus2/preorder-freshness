import {slotLabel} from '../utils/arrivalWindow';
import {useCallback,useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {readApiError} from '../utils/apiError';
import {basketSlotResult,deliveryInput,deliveryDateLabel,followingSearchDay} from '../utils/deliverySlots';
import './BasketSlots.css';

export default function BasketSlots({value='',...props}) {
 const day=value.slice(0,10);
 // A changed search date discards its old choices and aborts pending replies.
 return <SlotSearch key={day} day={day} {...props}/>;
}

function SlotSearch({day,onSelect,disabled=false,nextDisabled=disabled,selectedValue='',autoSearch=false,method='standard',windowMinutes=0}) {
 const [result,setResult]=useState(null),[busy,setBusy]=useState(autoSearch && !nextDisabled),[error,setError]=useState('');
 const [lastDay]=useState(()=>new Date(Date.now()+90*86400000+8*3600000).toISOString().slice(0,10));
 const request=useRef(null),pending=useRef(false),searchAnchor=useRef(day);
 const check=useCallback(async(searchFrom=day)=>{
  if(pending.current || nextDisabled)return;
  const controller=new AbortController();request.current=controller;pending.current=true;searchAnchor.current=searchFrom;
  setBusy(true);setError('');setResult(null);
  try {
   const {data}=await axios.post('/api/orders/slots/',{...(searchFrom?{date:searchFrom}:{}),find_next:true,delivery_method:method,arrival_window_minutes:windowMinutes},
    {signal:controller.signal,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(!controller.signal.aborted)setResult(basketSlotResult(data,windowMinutes));
  } catch(e) {
   if(!controller.signal.aborted)setError(e.code==='ECONNABORTED'?'Finding delivery times took too long. Please retry.':readApiError(e,'Delivery times could not be checked.'));
  } finally {
   pending.current=false;
   if(!controller.signal.aborted)setBusy(false);
  }
 },[day,nextDisabled,method,windowMinutes]);
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{
  if(!autoSearch || nextDisabled)return;
  const timer=setTimeout(()=>check(),200);
  return()=>clearTimeout(timer);
 },[autoSearch,nextDisabled,check]);
 const following=followingSearchDay(result);
 return <div className="basket-slot-search" aria-busy={busy}>
  {busy && <p role="status" className="basket-slot-loading">Finding available times for your whole basket…</p>}
  {!busy && !result && !error && <div className="basket-slot-actions"><button type="button" className="basket-next-day" disabled={nextDisabled} onClick={()=>check()}>Find delivery times</button></div>}
  {!nextDisabled && error && <div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={()=>check(searchAnchor.current)}>Retry finding times</button></div>}
  {result && !nextDisabled && (result.slots.length===0?<div role="status" className="basket-slot-empty">
   <strong>{result.code==='shipping_enquiry'?'Agree shipping with the kitchen.':result.code==='daily_capacity'?'Not enough daily menu capacity for this basket.':result.code==='quantity_limit'?'This quantity needs a different arrangement.':'No suitable delivery times in this search.'}</strong>
   {result.from && result.through && <p>Checked {deliveryDateLabel(result.from)} to {deliveryDateLabel(result.through)}.</p>}
   <p>{['shipping_enquiry','daily_capacity','quantity_limit','no_common_weekday','no_common_date'].includes(result.code)?result.reason:'Try the following week, adjust your basket, or ask the kitchen about a custom time.'}</p>
   {result.reason && !['shipping_enquiry','daily_capacity','quantity_limit','no_common_weekday','no_common_date'].includes(result.code) && <details><summary>Why these times need review</summary><p>{result.reason}</p></details>}
   {!['shipping_enquiry','quantity_limit','no_common_date','no_common_weekday'].includes(result.code) && following && following<=lastDay && <button type="button" disabled={busy || nextDisabled} onClick={()=>check(following)}>Check the following week</button>}
  </div>:<>
   <div role="status" className="basket-found-date"><strong>{day && result.date!==day?'Next available day':method==='pickup'?'Available collection times':'Available delivery times'} · {deliveryDateLabel(result.date)}</strong>
    {day && result.date!==day && <p>We found the next workable times after your preferred date.</p>}
    <p>Choose one time. Availability is checked again when you order.</p>
   </div>
   <div className="slot-suggestions" role="group" aria-label={'Available delivery times for '+deliveryDateLabel(result.date)}>{result.slots.map(slot=><button type="button" disabled={busy || nextDisabled} key={slot.delivery_at}
    aria-pressed={selectedValue===deliveryInput(slot.delivery_at)} onClick={()=>onSelect(deliveryInput(slot.delivery_at))}>
    {slotLabel(slot)}
   </button>)}</div>
  </>)}
 </div>;
}
