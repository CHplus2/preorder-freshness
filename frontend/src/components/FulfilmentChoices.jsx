import {fulfilmentHours,hourLabel,methodsFor} from '../utils/fulfilment';
import './FulfilmentChoices.css';

export default function FulfilmentChoices({store,value='standard',area='',onChange,disabled=false}){
 const options=methodsFor(store),pickup=value==='pickup';
 const [first,last]=fulfilmentHours(store,value);
 return <fieldset className="fulfilment-choices" disabled={disabled}><legend>Receive your preorder</legend>
  {!options.length?<p role="status">This kitchen is not accepting delivery or collection orders right now.</p>:<>
  <div className="fulfilment-methods">{options.filter(m=>m!=='express').map(method=><label key={method} className={pickup===(method==='pickup')?'selected':''}><input type="radio" name="fulfilment" checked={pickup===(method==='pickup')} onChange={()=>onChange(method,'')}/><span><strong>{method==='pickup'?'Self-collection':'Delivery'}</strong><small>{method==='pickup'?'Collect from the kitchen · no delivery fee':'Delivered to your saved address'}</small></span></label>)}</div>
  <p className="fulfilment-hours">{pickup?'Collection':'Delivery'} hours: {hourLabel(first)}–{hourLabel(last)} · Malaysia time. Preparation availability is checked separately.</p>
  {pickup?<div className="fulfilment-location"><strong>Collection location</strong><p>{store?.pickup_location}</p>{store?.pickup_instructions && <p>{store.pickup_instructions}</p>}</div>:<>
   {store?.delivery_areas?.length>0 && <label>Delivery area<select required value={area} onChange={e=>onChange(value,e.target.value)}><option value="">Choose your area</option>{store.delivery_areas.map(name=><option key={name} value={name}>{name}</option>)}</select><small>Outside these areas? Contact the kitchen before ordering.</small></label>}
   <label className="fulfilment-express"><input type="checkbox" checked={value==='express'} onChange={e=>onChange(e.target.checked?'express':'standard',area)}/>Request express delivery</label>
   {value==='express' && <p>The kitchen must confirm the courier and any additional charge. This does not book a Grab service.</p>}
  </>}
  </>}
 </fieldset>;
}
