import {contactNumber} from './handover.js';
import {arrivalLabel} from './arrivalWindow.js';
export const orderReference=id=>`ORD-${String(id).padStart(5,'0')}`;
export function kitchenOrderContact(store,order,{cancelled=false,reason=''}={}){
 const reference=orderReference(order.id),when=arrivalLabel(order);
 const items=(order.items||[]).map(item=>`${item.quantity} × ${item.product_name}`).join(', ');
 const text=[cancelled?`Hello, order #${reference} has been cancelled on the website.`:`Hello, I would like to ask about order #${reference}.`,
  `${order.delivery_method==='pickup'?'Collection':'Delivery'}: ${when}.`,items&&`Items: ${items}.`,
  cancelled&&reason.trim()?`Reason: ${reason.trim()}`:'',cancelled?'Please confirm you have seen the cancellation and let me know about any payment or refund.':'My question:'].filter(Boolean).join('\n');
 const phone=contactNumber(store?.whatsapp_number||'');
 return {text,whatsapp:phone?`https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(text)}`:null,
  fallback:`/contact?order=${order.id}`};
}
