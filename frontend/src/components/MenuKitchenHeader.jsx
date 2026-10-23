import {Link} from 'react-router-dom';
import {ChefHat,MapPin,CalendarDays,Users} from 'lucide-react';
import {kitchenPromotion} from '../utils/menuPresentation';
import './MenuKitchenHeader.css';

export default function MenuKitchenHeader({store}) {
 const offer=kitchenPromotion(store);
 return <section className="menu-kitchen-header" aria-labelledby="menu-welcome-title">
  <div className="menu-kitchen-identity"><span className="menu-kitchen-mark" aria-hidden="true"><ChefHat size={29}/></span><div><span className="menu-kitchen-eyebrow">{store.name} · Home kitchen</span><h1 id="menu-welcome-title">What sounds good?</h1><p>Choose your favourites. We’ll find {store.pickup_enabled?store.delivery_enabled===false?'collection':'collection or delivery':'delivery'} times for your basket.</p></div></div>
  <div className="menu-kitchen-facts"><span><CalendarDays size={15} aria-hidden="true"/>Preorder for your plans</span>{store.service_area && <span><MapPin size={15} aria-hidden="true"/>{store.service_area}</span>}<Link to="/contact">Ask the kitchen</Link></div>
  {offer && <div className="menu-group-offer"><Users size={18} aria-hidden="true"/><p><strong>{offer.percent}% off food from {offer.minimum} items</strong><span>Group discount applied in your basket. Delivery is separate.</span></p></div>}
 </section>;
}
