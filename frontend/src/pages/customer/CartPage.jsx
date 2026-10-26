import {shippingEnquiry,shippingContact} from '../../utils/sellingDetails';
import SellingDetails from '../../components/SellingDetails';
import {quantityLabel,unitLabel} from '../../utils/sellingDetails';
import FulfilmentChoices from '../../components/FulfilmentChoices';
import {fulfilmentKey} from '../../utils/fulfilment';
import MenuPhoto from '../../components/MenuPhoto';
import {useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,ShoppingBag,CalendarDays,Minus,Plus,Trash2} from 'lucide-react';
import DeliveryTimePicker from '../../components/DeliveryTimePicker';
import {basketAvailabilityKey} from '../../utils/deliverySlots';
import BasketDeliveryDays from '../../components/BasketDeliveryDays';
import OrderJourney from '../../components/OrderJourney';
import {PageMeta} from '../../components/BusinessLayout';
import {deliveryDaysText,deliveryDayIssue} from '../../utils/deliveryDays';
import {useUI} from '../../contexts/UIContext';
import {useCart} from '../../contexts/CartContext';
import './CartPage.css';

export default function CartPage(){
 const {formatPrice}=useUI();
 const {cart,cartLoading,cartError,cartUpdating,pricingReady,pricingError,refreshPricing,refreshCart,removeFromCart,updateQuantity,total,discount,SHIPPING_FEE,finalTotal,promotion,fulfilmentMethod='standard',deliveryArea='',chooseFulfilment}=useCart();
 const navigate=useNavigate();
 const updating=cartLoading || cartUpdating;
 const [selectedTime,setSelectedTime]=useState('');
 const [selectionKey,setSelectionKey]=useState('');
 const [slotNotice,setSlotNotice]=useState('');
 const basketKey=basketAvailabilityKey(cart)+fulfilmentKey(promotion,fulfilmentMethod,deliveryArea);
 const count=cart.reduce((n,i)=>n+i.quantity,0);
 const unavailable=cart.some(item=>shippingEnquiry(item.product.selling_details) || item.product.selling_status && item.product.selling_status!=='active');
 const incompatibleDays=Boolean(deliveryDayIssue(cart,''));
 return <main className="cart-container cart-storefront">
  <PageMeta title="Your basket" description="Review your food, check delivery times and continue to preorder checkout."/>
  <OrderJourney current="cart"/>
  <div className="cart-page-heading"><div><span className="cart-eyebrow">A LITTLE SOMETHING GOOD</span><h1 className="cart-title">Your basket</h1><p>A few favourites. One less thing to plan.</p></div><Link to="/menu"><ArrowLeft size={16} aria-hidden="true"/>Keep exploring</Link></div>
  {cartLoading && <p role="status">Loading your basket…</p>}
  {cartError && <p role="alert">{cartError} <button onClick={refreshCart}>Retry basket</button></p>}
  {!cartError && unavailable && <p role="alert" className="cart-unavailable">Some items need a separate shipping enquiry or are no longer accepting orders. Remove them from this basket to continue with local preorders.</p>}
  {!cartError && cart.length>0?<div className="cart-layout"><div className="cart-main">
   <section className="cart-choices" aria-labelledby="cart-choices-title"><div className="cart-section-heading"><h2 id="cart-choices-title">Your choices</h2><span>{count} {count===1?'item':'items'}</span></div>
    {updating && <p role="status" className="basket-update-status">Updating basket and totals…</p>}{cart.map(item=><article key={item.id} className="cart-item">
     <div className="cart-left"><div className="cart-image-wrapper"><ShoppingBag size={26} aria-hidden="true"/>{item.product.image_url && <MenuPhoto onError={event=>{event.currentTarget.hidden=true;}} sizes="100px" loading="lazy" src={item.product.image_url} alt="" className="cart-item-image"/>}</div><div className="cart-item-info"><Link to={`/products/${item.product.id}`} className="cart-item-name">{item.product.name}</Link><SellingDetails details={item.product.selling_details}/>{shippingEnquiry(item.product.selling_details) && <p><Link to={shippingContact(item.product.id)}>Agree shipping with the kitchen</Link> · Remove this offer from local checkout.</p>}{item.product.selling_status && item.product.selling_status!=='active' && <p className="cart-unavailable-label">Orders unavailable · Please remove this item</p>}{item.product.delivery_weekdays?.length>0 && <p className="cart-delivery-days">{deliveryDaysText(item.product.delivery_weekdays)}</p>}<p className="cart-item-price">{formatPrice(item.product.price)} / {unitLabel(item.product.selling_details)}</p></div></div>
     <div className="cart-right"><div className="qty-controls" role="group" aria-label={`Quantity of ${item.product.name}`}><button className="qty-btn" aria-label={`Decrease quantity of ${item.product.name}`} disabled={item.quantity<=1 || updating} onClick={()=>updateQuantity(item.id,Math.max(1,item.quantity-1))}><Minus size={15}/></button><span className="qty-number" aria-live="polite" aria-label={quantityLabel(item.product.selling_details,item.quantity)}>{item.quantity}</span><button className="qty-btn" aria-label={`Increase quantity of ${item.product.name}`} disabled={updating || shippingEnquiry(item.product.selling_details) || item.quantity>=10000 || Boolean(item.product.selling_status && item.product.selling_status!=='active')} onClick={()=>updateQuantity(item.id,item.quantity+1)}><Plus size={15}/></button></div><strong className="cart-line-total">{formatPrice(item.product.price*item.quantity)}</strong><button className="remove-btn" disabled={updating} aria-label={`Remove ${item.product.name} from basket`} onClick={()=>removeFromCart(item.id)}><Trash2 size={16} aria-hidden="true"/><span>Remove</span></button></div>
    </article>)}
   </section>
   <FulfilmentChoices store={promotion} value={fulfilmentMethod} area={deliveryArea} onChange={chooseFulfilment} disabled={updating || !pricingReady}/>{!unavailable && <BasketDeliveryDays cart={cart} showBasketLink={false}/>}
   {!unavailable && !incompatibleDays && <section className="cart-availability" aria-label="Basket delivery times"><div className="cart-section-heading"><h2><CalendarDays size={19} aria-hidden="true"/>Choose a {fulfilmentMethod==='pickup'?'collection':'delivery'} time</h2><span>Available options</span></div>
    <DeliveryTimePicker method={fulfilmentMethod} key={basketKey} cart={cart} value={selectionKey===basketKey?selectedTime:''} disabled={updating || !pricingReady} onSelect={time=>{setSelectionKey(basketKey);setSelectedTime(time);try{sessionStorage.setItem('preferredDelivery',time+':00+08:00');setSlotNotice('We’ll carry this time into checkout and check availability again.');}catch{setSlotNotice('We’ll carry this choice into checkout.');}}}/>
    {selectedTime && selectionKey===basketKey && <p role="status" className="cart-selected-time">{slotNotice}</p>}
   </section>}
  </div><aside className="cart-summary" aria-labelledby="cart-summary-title"><span className="cart-summary-icon"><ShoppingBag size={23} aria-hidden="true"/></span><h2 id="cart-summary-title">Order summary</h2><p>{cart.length} {cart.length===1?'choice':'choices'} · {count} {count===1?'item':'items'}</p>{!pricingReady?<div className="basket-pricing-status" role={pricingError?'alert':'status'}><p>{pricingError?'Kitchen pricing could not be loaded. Retry before checkout.':'Loading kitchen pricing…'}</p>{pricingError && <button type="button" onClick={refreshPricing}>Retry pricing</button>}</div>:<dl><div><dt>Food subtotal</dt><dd>{formatPrice(total)}</dd></div>{discount>0 && <div className="cart-discount"><dt>Bulk discount</dt><dd>−{formatPrice(discount)}</dd></div>}<div><dt>{fulfilmentMethod==='pickup'?'Collection':'Delivery'}</dt><dd>{SHIPPING_FEE?formatPrice(SHIPPING_FEE):'Free'}</dd></div><div className="cart-bill-total"><dt>Total</dt><dd>{formatPrice(finalTotal)}</dd></div></dl>}<p className="cart-summary-note">Confirm your fulfilment details, time and payment at checkout.</p><div className="cart-checkout-action order-action-bar"><div className="cart-mobile-total"><span>Total</span><strong>{pricingReady?formatPrice(finalTotal):'Checking…'}</strong></div><button className="checkout-btn" disabled={unavailable || incompatibleDays || updating || !pricingReady || Boolean(cartError)} onClick={()=>navigate('/checkout',{state:{preferredDelivery:selectionKey===basketKey && selectedTime?selectedTime+':00+08:00':''}})}>Continue to checkout <ArrowRight size={18} aria-hidden="true"/></button></div><Link className="cart-add-more" to="/menu">Add something else</Link></aside></div>:!cartLoading && !cartError && <section className="cart-empty"><ShoppingBag size={42} aria-hidden="true"/><h2>A good meal is a few clicks away.</h2><p>Your basket is empty. Find something you fancy from the kitchen.</p><Link to="/menu" className="dk-primary">Explore the menu <ArrowRight size={17} aria-hidden="true"/></Link></section>}
 </main>;
}
