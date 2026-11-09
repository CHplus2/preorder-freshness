import DeliveryAreasEditor from './DeliveryAreasEditor';
import {manualPaymentAvailable} from '../utils/checkoutPayment';
import './FulfilmentChoices.css';
export default function SimpleFulfilmentSettings({store,onChange,disabled=false,areaError='',onSavePickup,pickupSaving=false,pickupError='',onSaveDelivery,deliverySaving=false}){
 const update=value=>onChange({...store,...value});
 const clock=(key,label,fallback)=><label>{label}<input required type="time" step="60" value={(store[key]||fallback).slice(0,5)} onChange={e=>update({[key]:e.target.value})}/></label>;
 return <section className="settings-group fulfilment-settings simple-fulfilment-settings" id="fulfilment"><h2>Collection & delivery</h2><fieldset className="fulfilment-settings-fields" disabled={disabled}><legend className="sr-only">Collection and delivery settings</legend>
  <p>Choose when customers can receive food. These settings apply to new orders; accepted orders keep their agreed terms.</p>
  <section className="pickup-setup" id="pickup-setup"><h3>Self-collection</h3><p>{store.pickup_enabled?'Customers can collect from the kitchen.':'Add a collection location, then enable pickup.'} Self-collection accepts QR payment only.</p>
   {store.pickup_enabled&&!manualPaymentAvailable(store,'pickup')&&<p className="settings-field-error">Pickup is enabled, but customers need a receiving QR code before they can pay. <a href="#qr-payments">Set up QR payment</a>.</p>}
   <label>Collection location<input id="pickup-location" maxLength="250" required={!!store.pickup_enabled} value={store.pickup_location||''} onChange={e=>update({pickup_location:e.target.value})}/></label>
   <label>Collection instructions (optional)<textarea maxLength="1000" value={store.pickup_instructions||''} onChange={e=>update({pickup_instructions:e.target.value})}/></label>
   <div className="admin-fields">{clock('pickup_start_time','Collection from','07:30')}{clock('pickup_end_time','Collection until','11:00')}</div>
   <div className="pickup-save-actions"><button type="button" disabled={disabled||!onSavePickup} onClick={()=>onSavePickup(true)}>{pickupSaving?'Saving…':store.pickup_enabled?'Save pickup settings':'Enable pickup'}</button>{store.pickup_enabled&&<button type="button" disabled={disabled||!onSavePickup} onClick={()=>onSavePickup(false)}>Turn pickup off</button>}</div>
   {pickupError&&<p role="alert" className="settings-field-error">{pickupError}</p>}
  </section>
  <div id="shop-delivery-fee" className="delivery-setup">
  <label className="fulfilment-setting-toggle"><input type="checkbox" checked={store.delivery_enabled!==false} onChange={e=>update({delivery_enabled:e.target.checked})}/>Offer delivery</label>
  {store.delivery_enabled!==false&&<section className="fulfilment-setting-section"><div className="admin-fields">{clock('delivery_start_time','Delivery from','07:30')}{clock('delivery_end_time','Delivery until','11:00')}</div>
   <div><DeliveryAreasEditor store={store} onChange={onChange} disabled={disabled} error={areaError} onSave={onSaveDelivery} saving={deliverySaving} saveLabel="Save delivery settings" saveHelp="Saves delivery availability, hours, areas and fees for new orders. Existing orders keep their agreed terms."/></div>
  </section>}
  {store.delivery_enabled===false&&<div className="pickup-save-actions"><button type="button" disabled={disabled||!onSaveDelivery} onClick={onSaveDelivery}>{deliverySaving?'Saving…':'Save delivery settings'}</button><p>Save to turn delivery off. Existing orders keep their agreed arrangements.</p>{areaError&&<p className="settings-field-error" role="alert">{areaError}</p>}</div>}
  </div>
 </fieldset></section>;
}
