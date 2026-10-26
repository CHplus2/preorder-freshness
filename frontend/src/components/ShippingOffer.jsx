import {Link} from 'react-router-dom';
import {shippingEnquiry,shippingContact,dispatchWindow} from '../utils/sellingDetails';
import {malaysiaDate} from '../utils/planner';
import './SellingDetails.css';

export default function ShippingOffer({product,compact=false,link=true}){
 const details=product.selling_details;
 if(!shippingEnquiry(details))return null;
 const ended=details.dispatch_through<malaysiaDate(new Date());
 return <div className={`shipping-offer${compact?' shipping-offer--compact':''}`}>
  <strong>{ended?'Dispatch window ended':'Shipping enquiry'}</strong><p>Dispatch: {dispatchWindow(details)}</p>
  {!compact && <><p>These are dates for leaving the kitchen, not promised arrival dates. Agree the courier, shipping fee and arrival estimate with the owner before paying.</p>{details.shipping_note && <p>{details.shipping_note}</p>}<p>No order, payment or kitchen reservation is created by an enquiry.</p></>}
  {link && <Link className="shipping-enquiry-link" to={shippingContact(product.id)}>{ended?'Ask about the next release':'Ask about shipping'}</Link>}
 </div>;
}
