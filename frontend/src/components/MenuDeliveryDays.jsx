import './MenuDeliveryDays.css';
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export default function MenuDeliveryDays({value=[],onChange}) {
 return <fieldset className="menu-delivery-days"><legend>Delivery weekdays</legend>
 <p>Accept preorders at any time for these delivery days. Preparation can begin earlier.</p>
 <label className="delivery-day-choice"><input type="checkbox" checked={!value.length} onChange={e=>onChange(e.target.checked?[]:[0,1,2,3,4,5,6])}/>Every day</label>
 {!!value.length && <div className="delivery-day-grid">{days.map((day,index)=><label className="delivery-day-choice" key={day}><input type="checkbox" checked={value.includes(index)} disabled={value.length===1 && value.includes(index)} onChange={e=>onChange(e.target.checked?[...value,index].sort():value.filter(d=>d!==index))}/>{day}</label>)}</div>}
 <p className="delivery-day-note">{value.length?'Keep at least one delivery day selected. Use Pause orders to stop new orders.':'Customers can request any day; lead time and kitchen capacity still apply.'}</p>
 </fieldset>;
}
