import {Link} from 'react-router-dom';
import {ArrowRight} from 'lucide-react';
import {useStorefront} from '../contexts/StorefrontContext';

export default function CourierConnectionStatus(){
 const {store={}}=useStorefront()||{};
 return <section className="settings-group" id="courier" aria-labelledby="courier-connection-title">
  <h2 id="courier-connection-title">Courier delivery</h2>
  <p>Book the rider in your courier app, then save the courier reference and tracking link on the order so customers can follow the delivery.</p>
  <p>{store.ordering_mode==='scheduled'?'Confirm food ready, handover and delivery from your daily order list.':'Mark an order received after the customer has their food. You can confirm receipt for several orders together.'} A saved tracking link does not change order status automatically.</p>
  <Link className="admin-action-link" to={store.ordering_mode==='scheduled'?'/admin/planner?view=handover':'/admin/orders'}>Open orders<ArrowRight size={16} aria-hidden="true"/></Link>
 </section>;
}
