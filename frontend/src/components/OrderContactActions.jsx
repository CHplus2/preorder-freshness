import {useId,useState} from 'react';
import {orderContact} from '../utils/handover';
export default function OrderContactActions({order}){
 const contact=orderContact(order),[message,setMessage]=useState(''),[fallback,setFallback]=useState(false);
 const copyId=useId();
 if(['delivered','cancelled'].includes(order.status))return null;
 const copy=async()=>{try{await navigator.clipboard.writeText(contact.text);setFallback(false);setMessage('Order message copied. Review and send it in your messaging app.');}catch{setFallback(true);setMessage('Automatic copy is unavailable. Select and copy the order message below.');}};
 return <section className="order-contact-actions" aria-label={`Contact for order ${order.id}`}><div>{contact.phone?<a href={`tel:${contact.phone}`}>Call buyer</a>:<span>No usable phone recorded. Confirm contact details before handover.</span>}{contact.whatsapp && <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp buyer</a>}<button type="button" onClick={copy}>Copy order message</button></div><p>{contact.whatsapp?'WhatsApp opens a prepared draft. Review it and press Send there.':'Use the customer’s agreed contact channel. Copying a message does not send it.'} These actions do not update delivery status.</p>{message && <p role="status">{message}</p>}{fallback && <div className="order-message-copy"><label htmlFor={copyId}>Order message to copy for #{order.id}</label><textarea id={copyId} readOnly rows={5} value={contact.text} onFocus={e=>e.currentTarget.select()}/></div>}</section>;
}
