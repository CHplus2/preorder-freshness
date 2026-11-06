import {Link} from 'react-router-dom';
import {MapPin,ChevronDown,Users,MessageCircle} from 'lucide-react';
import {kitchenPromotion} from '../utils/menuPresentation';
import {methodsFor,fulfilmentTimes,timeLabel} from '../utils/fulfilment';
import './MenuKitchenHeader.css';

export default function MenuKitchenHeader({store,error=''}) {
 const offer=kitchenPromotion(error?null:store),methods=methodsFor(store);
 const hours=method=>fulfilmentTimes(store,method).map(timeLabel).join('–');
 const loaded=typeof store.delivery_enabled==='boolean' && typeof store.pickup_enabled==='boolean';
 return <section className="menu-kitchen-header" aria-labelledby="menu-welcome-title">
  <div className="menu-kitchen-top"><div className="menu-kitchen-identity"><span className="menu-kitchen-eyebrow">{store.name} · Home kitchen</span><h1 id="menu-welcome-title">The menu</h1><p>Choose your favourites, then choose delivery or collection at checkout.</p></div><Link className="menu-contact-link" to="/contact" aria-label="Ask the kitchen"><MessageCircle size={17} aria-hidden="true"/>Ask the kitchen</Link></div>
  {!error && loaded && !methods.length && <p className="menu-kitchen-unavailable" role="status">This kitchen is not accepting delivery or collection orders right now.</p>}
  <div className="menu-kitchen-bottom">
   {offer && <p className="menu-group-offer"><Users size={17} aria-hidden="true"/><span><strong>{offer.percent}% off food from {offer.minimum} items</strong><small>Applied in your basket · delivery separate</small></span></p>}
   <details className="menu-kitchen-details"><summary><MapPin size={16} aria-hidden="true"/>Kitchen details<ChevronDown size={15} aria-hidden="true"/></summary><div>
    {error?<p role="status">Kitchen details could not be loaded. Contact the kitchen to confirm collection and delivery arrangements.</p>:<>
     {store.service_area && <p><strong>Service area</strong>{store.service_area}</p>}
     {loaded && <>{methods.includes('standard') && <p><strong>Delivery</strong>{hours('standard')} · Malaysia time</p>}{methods.includes('pickup') && <p><strong>Self-collection</strong>{store.pickup_location}<br/>{hours('pickup')} · Malaysia time</p>}</>}
     <p>Menu dates, ordering cutoffs and availability apply. Checkout checks all items together.</p>
    </>}
   </div></details>
  </div>
 </section>;
}
