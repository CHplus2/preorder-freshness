import {Link} from 'react-router-dom';

export default function DeliveryEmailChoice({contact,checked,onChange,disabled=false,id='delivery-email-choice'}){
 if(!contact?.available)return null;
 return <div className="delivery-email-choice">
  {contact.email?<><label className="delivery-email-toggle" htmlFor={id}><input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/><span>Email me before delivery or collection</span></label><p>To {contact.email}. The service checks for confirmed orders within two hours of their agreed time. This is a reminder, not live arrival tracking.</p></>:<p><Link to="/account#delivery-email">Add an account email</Link> to choose delivery reminders.</p>}
 </div>;
}
