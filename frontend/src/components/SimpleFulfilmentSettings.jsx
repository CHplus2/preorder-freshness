import {useState} from 'react';
import './FulfilmentChoices.css';
export default function SimpleFulfilmentSettings({store,onChange,disabled=false,areaError='',onSavePickup,pickupSaving=false,pickupError=''}){
 const update=value=>onChange({...store,...value});
 const clock=(key,label,fallback)=><label>{label}<input required type="time" step="60" value={(store[key]||fallback).slice(0,5)} onChange={e=>update({[key]:e.target.value})}/></label>;
 const feeFor=name=>store.delivery_area_fees&&Object.hasOwn(store.delivery_area_fees,name)?store.delivery_area_fees[name]:store.delivery_fee_myr??'5.00';
 const areas=store.delivery_areas||[];
 const [areaText,setAreaText]=useState(()=>areas.join('\n'));
 const setAreas=value=>{setAreaText(value);const next=value.split('\n').map(s=>s.trim()).filter(Boolean);update({delivery_areas:next,delivery_area_fees:Object.fromEntries(next.map(name=>[name,feeFor(name)]))})};
 return <section className="settings-group fulfilment-settings" id="fulfilment"><h2>Collection & delivery</h2><fieldset className="fulfilment-settings-fields" disabled={disabled}><legend className="sr-only">Collection and delivery settings</legend>
  <p>Choose when customers can receive food. These settings apply to new orders; accepted orders keep their agreed terms.</p>
  <section className="pickup-setup" id="pickup-setup"><h3>Self-collection</h3><p>{store.pickup_enabled?'Customers can collect from the kitchen.':'Add a collection location, then enable pickup.'} Self-collection accepts QR payment only.</p>
   <label>Collection location<input id="pickup-location" maxLength="250" required={!!store.pickup_enabled} value={store.pickup_location||''} onChange={e=>update({pickup_location:e.target.value})}/></label>
   <label>Collection instructions (optional)<textarea maxLength="1000" value={store.pickup_instructions||''} onChange={e=>update({pickup_instructions:e.target.value})}/></label>
   <div className="admin-fields">{clock('pickup_start_time','Collection from','07:30')}{clock('pickup_end_time','Collection until','11:00')}</div>
   <div className="pickup-save-actions"><button type="button" disabled={disabled||!onSavePickup} onClick={()=>onSavePickup(true)}>{pickupSaving?'Saving…':store.pickup_enabled?'Save pickup settings':'Enable pickup'}</button>{store.pickup_enabled&&<button type="button" disabled={disabled||!onSavePickup} onClick={()=>onSavePickup(false)}>Turn pickup off</button>}</div>
   {pickupError&&<p role="alert" className="settings-field-error">{pickupError}</p>}
  </section>
  <label className="fulfilment-setting-toggle"><input type="checkbox" checked={store.delivery_enabled!==false} onChange={e=>update({delivery_enabled:e.target.checked})}/>Offer delivery</label>
  {store.delivery_enabled!==false&&<section className="fulfilment-setting-section"><div className="admin-fields">{clock('delivery_start_time','Delivery from','07:30')}{clock('delivery_end_time','Delivery until','11:00')}</div>
   <h3 id="shop-delivery-fee">Delivery fees by area</h3><p>Customers pay the recorded fee with their order. Set the amount you charge for each area; it is not a live courier quote.</p>
   <label htmlFor="delivery-area-names">Delivery areas (one per line)</label><textarea id="delivery-area-names" rows="3" maxLength="2430" value={areaText} onChange={e=>setAreas(e.target.value)}/><p className="checkout-hint">Up to 30 short area names. Leave blank to accept any area at the default fee.</p>
   {areaError&&<p role="alert" className="settings-field-error">{areaError}</p>}
   <div className="admin-fields">{areas.map(name=><label key={name}>{name} delivery fee (RM)<input required type="number" min="0" max="999999.99" step="0.01" value={feeFor(name)} onChange={e=>update({delivery_area_fees:{...store.delivery_area_fees,[name]:e.target.value}})}/></label>)}</div>
   <div className="admin-fields"><label>Default delivery fee (RM)<input required type="number" min="0" max="999999.99" step="0.01" value={store.delivery_fee_myr??'5.00'} onChange={e=>update({delivery_fee_myr:e.target.value})}/></label><label>Free delivery from food subtotal (RM, optional)<input type="number" min="0" max="999999.99" step="0.01" value={store.free_delivery_minimum_myr??''} onChange={e=>update({free_delivery_minimum_myr:e.target.value===''?null:e.target.value})}/></label></div>
   <p>Areas without a separate fee use the default. Leave the free-delivery threshold blank to always charge the area’s fee. Existing orders keep their recorded fee.</p>
  </section>}
 </fieldset></section>;
}
