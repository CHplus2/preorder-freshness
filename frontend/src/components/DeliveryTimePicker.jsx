import ArrivalWindowChoice from './ArrivalWindowChoice';
import {arrivalLabel,makeArrivalWindow} from '../utils/arrivalWindow';
import {useId,useState} from 'react';
import {Link} from 'react-router-dom';
import BasketSlots from './BasketSlots';
import {basketAvailabilityKey} from '../utils/deliverySlots';
import {deliveryDayIssue} from '../utils/deliveryDays';

export default function DeliveryTimePicker({cart,value='',day='',onSelect,disabled=false,allowRequest=false,requestMode=false,onRequestMode,refreshKey='',selectionUnavailable=false,method='standard',windowMinutes=0,onWindowChange}) {
 const [editing,setEditing]=useState(()=>!value);
 const [preferredDay,setPreferredDay]=useState(()=>value.slice(0,10) || day);
 const [openedAt]=useState(()=>Date.now());
 const dateId=useId(),customId=useId();
 const localInput=stamp=>new Date(stamp+8*3600000).toISOString().slice(0,16);
 const today=localInput(openedAt).slice(0,10),last=localInput(openedAt+90*86400000);
 const incompatible=Boolean(deliveryDayIssue(cart,''));
 const choose=time=>{onRequestMode?.(false);onSelect(time);setEditing(false);};
 const showChoices=editing || !value || selectionUnavailable || requestMode;
 return <div className="delivery-time-picker">
  {value && !requestMode && Number.isFinite(Date.parse(value+':00+08:00')) && <div className="delivery-selection-review"><p className={'delivery-selected'+(selectionUnavailable?' delivery-selected-unavailable':'')} role="status">{selectionUnavailable?'Time needs another check':method==='pickup'?'Selected collection':windowMinutes?'Selected arrival window':'Selected delivery'} <strong>{arrivalLabel({delivery_at:value+':00+08:00',arrival_window:makeArrivalWindow(value+':00+08:00',windowMinutes)})}</strong><span>{selectionUnavailable?'Choose another available time.':allowRequest?'Availability is checked before you place the order.':'We’ll carry this time into checkout and check availability again.'}</span></p>{!showChoices && <button type="button" className="delivery-change-time" disabled={disabled} onClick={()=>setEditing(true)}>Change {method==='pickup'?'collection':'delivery'} time</button>}</div>}
  {showChoices && <>
  {method!=='pickup' && onWindowChange && <ArrivalWindowChoice value={windowMinutes} onChange={onWindowChange} disabled={disabled}/>}
  <p className="delivery-picker-intro">Choose from {method==='pickup'?'collection':'delivery'} times that fit your whole basket. We check preparation time, kitchen bookings and menu delivery days for you.</p>
  <label htmlFor={dateId}>Preferred day <span>(optional)</span></label>
  <input id={dateId} type="date" min={today} max={last.slice(0,10)} value={preferredDay} disabled={disabled} onChange={e=>setPreferredDay(e.target.value)}/>
  <p className="delivery-picker-hint">Leave blank for the next available day. If your preferred day is full, we’ll show the next options.</p>
  <BasketSlots key={basketAvailabilityKey(cart)+refreshKey+method+windowMinutes} method={method} windowMinutes={windowMinutes} value={preferredDay} autoSearch selectedValue={!requestMode?value:''}
   disabled={disabled || incompatible || !cart.length} onSelect={choose}/>
  {editing && value && !selectionUnavailable && !requestMode && <button type="button" className="delivery-change-time" disabled={disabled} onClick={()=>setEditing(false)}>Keep selected time</button>}
  </>}
  {allowRequest?<div className="delivery-custom-option">
   <button type="button" className="delivery-request-toggle" disabled={disabled} aria-expanded={requestMode} aria-controls={customId}
    onClick={()=>{onRequestMode(!requestMode);onSelect('');}}>{requestMode?'Choose an available time instead':'Need a different time? Ask the kitchen'}</button>
   {requestMode && <div id={customId} className="delivery-custom-request"><label>{windowMinutes?'Requested window ends':'Requested date and time'}<input type="datetime-local" required disabled={disabled} min={localInput(openedAt+60000)} max={last} value={value} onChange={e=>onSelect(e.target.value)}/></label><p>{windowMinutes>0 && <>The arrival window ends at the selected time. </>}This is a custom request. If it cannot be scheduled automatically, the kitchen must confirm it before preparation is reserved. No payment is taken for an unconfirmed request.</p></div>}
  </div>:<p className="delivery-picker-hint">Need a different arrangement? You can <Link to="/checkout">ask the kitchen at checkout</Link>.</p>}
 </div>;
}
