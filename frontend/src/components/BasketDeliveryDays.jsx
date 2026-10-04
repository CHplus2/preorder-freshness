import {Link} from 'react-router-dom';
import {basketDaysText,deliveryDayIssue} from '../utils/deliveryDays';
import './BasketDeliveryDays.css';
export default function BasketDeliveryDays({cart,value}) {
 if(!cart.some(item=>item.product.delivery_weekdays?.length))return null;
 const issue=deliveryDayIssue(cart,value);
 const common=basketDaysText(cart);
 return <div className="basket-delivery-days"><strong>Delivery days for your basket</strong>
 {common && <p>{common}. Kitchen availability still needs to be checked.</p>}
 {issue && <p role="alert">{issue}</p>}
 {!common && <Link to="/cart">Review basket</Link>}
 </div>;
}
