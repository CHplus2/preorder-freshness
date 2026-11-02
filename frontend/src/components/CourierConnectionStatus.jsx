import {Link} from 'react-router-dom';

export default function CourierConnectionStatus(){
 return <section className="settings-group" id="courier" aria-labelledby="courier-connection-title">
  <h2 id="courier-connection-title">Courier delivery</h2>
  <p>Book the rider in your courier app, then save the courier reference and tracking link on the order so customers can follow the delivery.</p>
  <p>Confirm food ready, handover and delivery from your daily order list. You can update several eligible orders together. A saved tracking link does not change order status automatically.</p>
  <Link to="/admin/planner?view=handover">Open collection & delivery runs</Link>
 </section>;
}
