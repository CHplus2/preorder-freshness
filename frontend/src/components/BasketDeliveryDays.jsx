import {Link} from 'react-router-dom';
import {basketDaysText,deliveryDayIssue,basketCutoffs} from '../utils/deliveryDays';
import './BasketDeliveryDays.css';
export default function BasketDeliveryDays({cart,value,showBasketLink=true}) {
 if(!cart.some(({product:p})=>p.delivery_weekdays?.length || p.delivery_dates?.length || p.order_cutoff_time))return null;
 const issue=deliveryDayIssue(cart,value);
 const common=basketDaysText(cart);
 return <div className="basket-delivery-days"><strong>Ordering dates for your basket</strong>
 {common && <p>{common}. Kitchen availability still needs to be checked.</p>}
 {basketCutoffs(cart).map(text=><p key={text}>{text}</p>)}
 {issue && <p role="alert">{issue}</p>}
 {!common && showBasketLink && <Link to="/cart">Review basket</Link>}
 </div>;
}
