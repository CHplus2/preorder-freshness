import {fulfilmentTimes} from '../utils/fulfilment';
import {useStorefront} from '../contexts/StorefrontContext';
import ArrivalWindowChoice from './ArrivalWindowChoice';
import {arrivalLabel,makeArrivalWindow} from '../utils/arrivalWindow';
import {useEffect,useId,useRef,useState} from 'react';
import {defaultDeliveryDay,malaysiaInput,simpleTimeIssue} from '../utils/simpleDeliveryTime';
import {timeLabel} from '../utils/fulfilment';
import {Link} from 'react-router-dom';
import BasketSlots from './BasketSlots';
import {basketAvailabilityKey,deliveryDateLabel} from '../utils/deliverySlots';
import {basketDaysText,deliveryDayIssue} from '../utils/deliveryDays';
import {basketDateIssue,upcomingBasketDates} from '../utils/basketOrderingDates';
import {CalendarDays,ArrowRight} from 'lucide-react';
import './OrderingDateChoices.css';

function ScheduledDeliveryTimePicker({cart,value='',day='',onSelect,disabled=false,allowRequest=false,requestMode=false,onRequestMode,refreshKey='',selectionUnavailable=false,method='standard',windowMinutes=0,onWindowChange}) {
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
  <p className="delivery-picker-intro">Choose a {method==='pickup'?'collection':'delivery'} time for your whole basket. Preparation, kitchen bookings and the menus’ offered days are checked together.</p>
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

export default function DeliveryTimePicker(props){
 const {store}=useStorefront();
 return store.ordering_mode==='scheduled'?<ScheduledDeliveryTimePicker {...props}/>:<SimpleTimePicker {...props} store={store}/>;
}
function SimpleTimePicker({cart=[],value='',day='',method='standard',onSelect,disabled,store,windowMinutes,onWindowChange}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[]);
 const pickup=method==='pickup',[opening,closing]=fulfilmentTimes(store,method);
 const dates=upcomingBasketDates(cart,closing,now);
 const [chosenDay,setDay]=useState(()=>value.slice(0,10)||day||(cart.length?dates[0]||'':defaultDeliveryDay(closing,now)));
 const [clock,setClock]=useState(()=>value.slice(11));
 const issueId=useId(),dateHelpId=useId(),dateErrorId=useId(),dateInput=useRef(null);
 // An invalid draft stays visible; only valid selections enter shared checkout state.
 const [syncedValue,setSyncedValue]=useState(value);
 if(value!==syncedValue){setSyncedValue(value);if(value){setDay(value.slice(0,10));setClock(value.slice(11));}}
 const dateIssue=basketDateIssue(cart,chosenDay,closing,now),issue=simpleTimeIssue(chosenDay,clock,opening,closing,now);
 useEffect(()=>{dateInput.current?.setCustomValidity(dateIssue)},[dateIssue]);
 useEffect(()=>{if(value&&(dateIssue||issue))onSelect('')},[value,dateIssue,issue,onSelect]);
 const choose=(date,time)=>{setDay(date);setClock(time);onSelect(date&&time&&!basketDateIssue(cart,date,closing,now)&&!simpleTimeIssue(date,time,opening,closing,now)?date+'T'+time:'');};
 const common=basketDaysText(cart),incompatible=deliveryDayIssue(cart,'',now);
 return <div className="delivery-time-picker simple-time-picker">
  {!pickup&&onWindowChange&&<ArrivalWindowChoice value={windowMinutes} onChange={onWindowChange} disabled={disabled}/>}
  <p className="delivery-picker-intro">Choose one date and time for the whole basket.</p>
  {cart.length>0&&<div className="basket-ordering-dates" id={dateHelpId}>
   <p className="basket-offered-days"><CalendarDays size={18} aria-hidden="true"/><span><strong>Offered for this basket</strong>{common&&!incompatible?<span>{common}</span>:<span>These items need separate ordering dates.</span>}</span></p>
   {dates.length>0?<><p className="ordering-dates-label">Upcoming ordering dates</p><div className="ordering-date-choices" role="group" aria-label="Upcoming ordering dates">{dates.map(date=><button type="button" key={date} disabled={disabled} aria-label={deliveryDateLabel(date)} aria-pressed={chosenDay===date} onClick={()=>choose(date,clock)}><time dateTime={date}><span>{new Date(date+'T12:00:00+08:00').toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',weekday:'short'})}</span><strong>{new Date(date+'T12:00:00+08:00').toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short'})}</strong></time></button>)}</div></>:<p className="ordering-date-empty">{incompatible||'No upcoming date matches these menus within the next 90 days.'} <Link to="/cart">Edit basket<ArrowRight size={14} aria-hidden="true"/></Link></p>}
   <p className="ordering-dates-note">Dates match the menus’ offered days and cutoffs. Ingredient and packaging stock is checked after you choose a time.</p>
  </div>}
  <div className="simple-date-fields"><div className="simple-date-field"><label>Delivery or collection date<input ref={dateInput} required type="date" min={malaysiaInput(now).slice(0,10)} max={malaysiaInput(now+90*86400000).slice(0,10)} value={chosenDay} disabled={disabled} aria-invalid={!!dateIssue} aria-describedby={dateIssue?`${dateHelpId} ${dateErrorId}`:cart.length?dateHelpId:undefined} onChange={e=>choose(e.target.value,clock)}/></label>{dateIssue&&<p id={dateErrorId} role="alert" className="ordering-date-error">{dateIssue} {dates.length>0&&'Choose one of the ordering dates above.'}</p>}</div>
  <label>{pickup?'Collection':'Delivery'} time<input required type="time" step="60" min={opening} max={closing} value={clock} disabled={disabled} aria-invalid={!!issue&&!dateIssue} aria-describedby={issue&&!dateIssue?issueId:undefined} onChange={e=>choose(chosenDay,e.target.value)}/></label></div>
  <p className="delivery-picker-hint">{timeLabel(opening)}–{timeLabel(closing)} · Malaysia time</p>
  {!dateIssue&&issue&&<p id={issueId} role="alert" className="ordering-date-error">{issue}</p>}
 </div>;
}
