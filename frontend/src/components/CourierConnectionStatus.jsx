import {Link} from 'react-router-dom';

export default function CourierConnectionStatus(){
 return <section className="settings-group" id="courier" aria-labelledby="courier-connection-title">
  <h2 id="courier-connection-title">Courier delivery</h2>
  <p><strong>Manual updates · no courier API connected</strong></p>
  <p>Book the rider in your courier app, then save the courier reference and tracking link on the order. Customers can open that link. The kitchen records food ready, courier handover and actual delivery; several eligible orders can be updated together.</p>
  <Link to="/admin/planner?view=handover">Open collection & delivery runs</Link>
  <details><summary>Enable automatic courier updates later</summary>
   <p>Approved GrabExpress API access and the provider’s current integration documentation are required. Connecting an account still needs booking-reference mapping, verified courier events and end-to-end tests before automatic order updates can be enabled.</p>
   <p>Email reminder scheduling does not track a rider. Planned times and a saved tracking link do not confirm pickup or delivery.</p>
   <a href="https://developer.grab.com/" target="_blank" rel="noopener noreferrer">Grab developer information</a>
  </details>
 </section>;
}
