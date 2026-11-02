import {useId,useState} from 'react';
import {recipientDetails} from '../utils/courierHandover';
import {contactNumber} from '../utils/handover';
import CourierTrackingEditor from './CourierTrackingEditor';
import './CourierHandover.css';

export default function CourierHandover({order,onSaved}){
 const [message,setMessage]=useState(''),[fallback,setFallback]=useState(false);
 const copyId=useId();
 if(order.delivery_method==='pickup' || order.status==='cancelled')return null;
 if(order.status==='delivered')return <CourierTrackingEditor order={order} onSaved={onSaved}/>;
 const recipient=recipientDetails(order);
 const courierPhone=contactNumber(order.fulfilment_snapshot?.courier?.contact_phone || '');
 async function copy(){
  try{await navigator.clipboard.writeText(recipient.text);setFallback(false);setMessage('Recipient details copied. Review them in your courier booking before submitting it.');}
  catch{setFallback(true);setMessage('Automatic copy is unavailable. Select and copy the details below.');}
 }
 return <details className="courier-handover"><summary>Arrange courier handover</summary>
  <p>Book the rider in your courier app. Use the customer as recipient and the kitchen as pickup contact. This website does not book a rider or receive live courier events.</p>
  {recipient.reviewTime && <p className="courier-handover-review">The requested arrival still needs kitchen confirmation. Agree a workable time before booking.</p>}
  <dl><div><dt>Recipient</dt><dd>{recipient.name || 'Confirm name with customer'}</dd></div><div><dt>Recipient phone</dt><dd>{recipient.phone || 'Confirm number with customer'}</dd></div><div><dt>Order’s delivery address</dt><dd>{recipient.lines.length?recipient.lines.map((line,i)=><span key={i}>{line}</span>):'Confirm address with customer'}</dd></div></dl>
  <p>{recipient.arrangement}</p>{recipient.notes && <p className="courier-handover-note">{recipient.notes}</p>}
  {!recipient.fromSnapshot && <p className="courier-handover-review">This older order has no saved address snapshot. Verify the address with the customer before booking.</p>}
  {recipient.missing.length>0 && <p className="courier-handover-review">Confirm before booking: {recipient.missing.join(', ')}. Copying these details does not verify them.</p>}
  <button type="button" onClick={copy}>Copy recipient details</button>{message && <p role="status">{message}</p>}
  {fallback && <div className="courier-copy-fallback"><label htmlFor={copyId}>Recipient details to copy</label><textarea id={copyId} readOnly rows={8} value={recipient.text} onFocus={e=>e.currentTarget.select()}/></div>}
  <p>Use these details only for this order’s delivery. When food leaves with the rider, record <strong>Handed to courier</strong> to queue opted-in dispatch emails. Confirm delivery only after actual receipt.</p>
  {courierPhone && <p><a href={`tel:${courierPhone}`}>Call courier</a> · {courierPhone}</p>}
  <CourierTrackingEditor key={order.id+'-'+order.updated_at} order={order} onSaved={onSaved} embedded/>
 </details>;
}
