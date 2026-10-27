import {arrivalLabel} from './arrivalWindow.js';
import {contactNumber,handoverDetails,orderAddress} from './handover.js';

const clean=value=>typeof value==='string'?value.replace(/\p{Cc}/gu,' ').replace(/\s+/g,' ').trim():'';
export function recipientDetails(order){
 // Do not combine an accepted address with an edited account address. Older
 // orders without a snapshot can use the serializer's historical fallback.
 const address=orderAddress(order);
 const fromSnapshot=!!(order.delivery_address && typeof order.delivery_address==='object' && !Array.isArray(order.delivery_address) && Object.keys(order.delivery_address).length);
 const saved=handoverDetails(order);
 const name=clean(address.recipient_name),phone=contactNumber(saved.contact_phone);
 const lines=[clean(address.line1),clean(address.line2),[clean(address.postal_code),clean(address.city)].filter(Boolean).join(' '),clean(address.state),clean(address.country)].filter(Boolean);
 const missing=[!name && 'recipient name',!phone && 'usable recipient phone',!clean(address.line1) && 'street address',!clean(address.city) && 'city',!clean(address.postal_code) && 'postcode'].filter(Boolean);
 const arrangement=saved.mode==='agreed_place'?`Leave only at the customer-authorised place: ${clean(saved.location) || 'confirm the location with the customer'}.`:'Hand to a person. Call the recipient if nobody answers; no unattended drop-off is authorised.';
 const reviewTime=!!order.preparation_plan?.needs_review || !Number.isFinite(Date.parse(order.delivery_at || ''));
 const text=[`Food delivery · order #${order.id}`,`Recipient: ${name || 'confirm name with customer'}`,`Recipient phone: ${phone || 'confirm number with customer'}`,
  `Delivery address: ${lines.length?lines.join(', '):'confirm address with customer'}`,
  `${reviewTime?'Requested arrival (not confirmed)':'Agreed arrival'}: ${arrivalLabel(order)}`,
  arrangement,'Keep food clear of driveways and vehicle paths.',saved.notes?`Handover note: ${clean(saved.notes)}`:'',
  missing.length?`Before booking, confirm: ${missing.join(', ')}.`:'',
  !fromSnapshot?'For this older order, confirm the address with the customer before booking.':''].filter(Boolean).join('\n');
 return {name,phone,lines,missing,arrangement,notes:clean(saved.notes),text,fromSnapshot,reviewTime};
}

export function trackingSaved(data,order,input){
 const saved=data?.order,courier=saved?.fulfilment_snapshot?.courier;
 if(saved?.id!==order.id || saved.status!==order.status || saved.payment_status!==order.payment_status || !Number.isFinite(Date.parse(saved.updated_at || '')) || !courier
  || courier.carrier!==input.carrier.trim() || courier.reference!==input.reference.trim()
  || courier.url!==input.url.trim() || courier.contact_phone!==contactNumber(input.contact_phone))throw new Error('Unexpected tracking response');
 return saved;
}
