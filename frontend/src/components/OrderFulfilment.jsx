import {isPickup,methodLabel} from '../utils/fulfilment';
import './FulfilmentChoices.css';
export default function OrderFulfilment({order}){
 const saved=order.fulfilment_snapshot || {};
 return <section className="order-fulfilment" aria-label="Fulfilment details"><strong>{saved.label || methodLabel(order.delivery_method)}</strong>
  {isPickup(order)?<><p>Collect from: {saved.pickup_location || 'Contact the kitchen to confirm the collection location.'}</p>{saved.pickup_instructions && <p>{saved.pickup_instructions}</p>}<p>No delivery fee. Payment and preparation progress are recorded separately.</p></>:saved.delivery_area && <p>Delivery area: {saved.delivery_area}</p>}
 </section>;
}
