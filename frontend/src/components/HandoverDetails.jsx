import {handoverDetails} from '../utils/handover';
export default function HandoverDetails({order}){
 const saved=handoverDetails(order),pickup=order.delivery_method==='pickup';
 return <div className="handover-details"><strong>{pickup?'Collection arrangement':'Handover arrangement'}</strong><p>{pickup?'Hand to the person collecting.':saved.mode==='agreed_place'?`Customer-authorised place: ${saved.location}`:'Hand to a person. Contact the buyer if nobody answers.'}</p>{saved.contact_phone && <p>{saved.contact_method==='whatsapp'?'WhatsApp preferred':'Phone contact'}: {saved.contact_phone}</p>}{saved.notes && <p className="handover-notes">{saved.notes}</p>}</div>;
}
