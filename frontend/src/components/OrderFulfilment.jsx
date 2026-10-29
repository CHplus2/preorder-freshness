import {arrivalLabel} from '../utils/arrivalWindow';
import HandoverDetails from './HandoverDetails';
import {isPickup,methodLabel} from '../utils/fulfilment';
import './FulfilmentChoices.css';
export default function OrderFulfilment({order,owner=false}){
 const saved=order.fulfilment_snapshot || {};
 return <section className="order-fulfilment" aria-label="Fulfilment details"><strong>{methodLabel(order.delivery_method)}</strong>
  {isPickup(order)?<><p>Collect from: {saved.pickup_location || 'Contact the kitchen to confirm the collection location.'}</p>{saved.pickup_instructions && <p>{saved.pickup_instructions}</p>}<p>No delivery fee. Payment and preparation progress are recorded separately.</p></>:saved.delivery_area && <p>Delivery area: {saved.delivery_area}</p>}
  {order.delivery_method==='express' && <p>Express was requested. This does not confirm a faster courier service; agree any special arrangement with the kitchen.</p>}
  {!isPickup(order) && saved.courier?.reference && <div className="courier-reference"><strong>{saved.courier.carrier}</strong><p>Tracking: {saved.courier.reference}</p>{/^https:\/\//.test(saved.courier.url || '') && <a href={saved.courier.url} target="_blank" rel="noopener noreferrer">Track with courier</a>}<p>Details entered by the kitchen. Check the courier for live updates; payment and order progress are separate.</p></div>}
  {!isPickup(order) && !saved.courier?.reference && <p>The kitchen updates delivery progress. Courier tracking details will appear here when the kitchen adds them.</p>}
  {order.arrival_window && <p>{order.preparation_plan?.needs_review?'Requested arrival window':'Arrival window'}: {arrivalLabel(order)}. {order.preparation_plan?.needs_review?'The kitchen still needs to confirm this request.':'Preparation is planned against the latest arrival. Agree any earlier or later handover with the kitchen.'}</p>}
  {owner && order.dispatch_by && <p>Dispatch target: {new Date(order.dispatch_by).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})} · based on the recorded delivery buffer.</p>}
  <HandoverDetails order={order}/>{owner && saved.courier?.contact_phone && <p><a href={`tel:${saved.courier.contact_phone}`}>Call courier</a> · {saved.courier.contact_phone}</p>}
 </section>;
}
