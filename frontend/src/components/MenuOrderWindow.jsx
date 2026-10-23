import {useState} from 'react';
import {cutoffText,validDeliveryDate,deliveryDateText} from '../utils/preorderWindows';
import './MenuOrderWindow.css';

export default function MenuOrderWindow({value,onChange}) {
 const [date,setDate]=useState(''),[error,setError]=useState('');
 const dates=value.delivery_dates || [];
 const update=change=>onChange({...value,...change});
 const add=()=>{
  if(!validDeliveryDate(date)){setError('Choose a valid delivery date first.');return;}
  if(dates.includes(date)){setError('This date is already offered.');return;}
  update({delivery_dates:[...dates,date].sort()});setDate('');setError('');
 };
 return <fieldset className="menu-order-window"><legend>Preorder dates & cutoff</legend>
  <p>For a daily meal deadline or a seasonal sale. Leave both options empty for regular ordering.</p>
  <h4>Specific delivery dates <span>(optional)</span></h4>
  <p>{dates.length?'Only the dates below are offered. Delivery weekdays also apply.':'No specific dates set. Customers can choose any permitted delivery weekday within the 90-day booking window.'}</p>
  <div className="preorder-date-entry"><label>Offer a delivery date<input type="date" value={date} onChange={e=>{setDate(e.target.value);setError('');}}/></label><button type="button" disabled={dates.length>=90} onClick={add}>Add date</button></div>
  {error && <p role="alert">{error}</p>}
  {dates.length>0 && <ul className="preorder-date-list">{dates.map(day=><li key={day}><span>{deliveryDateText(day)}</span><button type="button" aria-label={`Remove delivery date ${deliveryDateText(day)}`} onClick={()=>update({delivery_dates:dates.filter(d=>d!==day)})}>Remove</button></li>)}</ul>}
  <label className="preorder-cutoff-toggle"><input type="checkbox" checked={!!value.order_cutoff_time} onChange={e=>update({order_cutoff_time:e.target.checked?'17:00:00':null})}/>Set an order cutoff</label>
  {value.order_cutoff_time && <><div className="preorder-cutoff-fields"><label>Orders close at (Malaysia time)<input type="time" required step="60" value={value.order_cutoff_time.slice(0,5)} onChange={e=>update({order_cutoff_time:e.target.value?`${e.target.value}:00`:null})}/></label><label>Days before delivery<input type="number" min="0" max="90" step="1" value={value.order_cutoff_days_before ?? 1} onChange={e=>update({order_cutoff_days_before:e.target.value===''?'':Number(e.target.value)})}/></label></div><p className="preorder-rule-preview">{cutoffText(value)}.</p></>}
  <p className="preorder-window-note">The cutoff is the latest time to place an order. Cooking advance notice and kitchen capacity may require ordering earlier. Changes here apply to new orders; accepted orders keep their saved settings.</p>
 </fieldset>;
}
