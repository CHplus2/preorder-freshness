import {useId,useState} from 'react';
import {Link} from 'react-router-dom';
import BasketSlots from './BasketSlots';
import {basketAvailabilityKey} from '../utils/deliverySlots';
import {deliveryDayIssue} from '../utils/deliveryDays';

export default function DeliveryTimePicker({cart,value='',onSelect,disabled=false,allowRequest=false,requestMode=false,onRequestMode,refreshKey='',selectionUnavailable=false}) {
 const [preferredDay,setPreferredDay]=useState(()=>value.slice(0,10));
 const [openedAt]=useState(()=>Date.now());
 const dateId=useId(),customId=useId();
 const localInput=stamp=>new Date(stamp+8*3600000).toISOString().slice(0,16);
 const today=localInput(openedAt).slice(0,10),last=localInput(openedAt+90*86400000);
 const incompatible=Boolean(deliveryDayIssue(cart,''));
 const choose=time=>{onRequestMode?.(false);onSelect(time);};
 return <div className="delivery-time-picker">
  <p className="delivery-picker-intro">Choose from times that fit your whole basket. We check preparation time, kitchen bookings and menu delivery days for you.</p>
  <label htmlFor={dateId}>Preferred day <span>(optional)</span></label>
  <input id={dateId} type="date" min={today} max={last.slice(0,10)} value={preferredDay} disabled={disabled} onChange={e=>setPreferredDay(e.target.value)}/>
  <p className="delivery-picker-hint">Leave blank for the next available day. If your preferred day is full, we’ll show the next options.</p>
  <BasketSlots key={basketAvailabilityKey(cart)+refreshKey} value={preferredDay} autoSearch selectedValue={!requestMode?value:''}
   disabled={disabled || incompatible || !cart.length} onSelect={choose}/>
  {value && !requestMode && Number.isFinite(Date.parse(value+':00+08:00')) && <p className={'delivery-selected'+(selectionUnavailable?' delivery-selected-unavailable':'')} role="status">{selectionUnavailable?'Previously selected time':'Selected delivery'} <strong>{new Date(value+':00+08:00').toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})}</strong><span>Malaysia time{selectionUnavailable?' · choose another available time':''}</span></p>}
  {allowRequest?<div className="delivery-custom-option">
   <button type="button" className="delivery-request-toggle" disabled={disabled} aria-expanded={requestMode} aria-controls={customId}
    onClick={()=>{onRequestMode(!requestMode);onSelect('');}}>{requestMode?'Choose an available time instead':'Need a different time? Ask the kitchen'}</button>
   {requestMode && <div id={customId} className="delivery-custom-request"><label>Requested date and time<input type="datetime-local" required disabled={disabled} min={localInput(openedAt+60000)} max={last} value={value} onChange={e=>onSelect(e.target.value)}/></label><p>This is a custom request. If it cannot be scheduled automatically, the kitchen must confirm it before preparation is reserved. No payment is taken for an unconfirmed request.</p></div>}
  </div>:<p className="delivery-picker-hint">Need a different arrangement? You can <Link to="/checkout">ask the kitchen at checkout</Link>.</p>}
 </div>;
}
