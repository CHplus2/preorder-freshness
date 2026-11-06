import {shippingEnquiry,shippingContact} from '../../utils/sellingDetails';
import SellingDetails from '../../components/SellingDetails';
import {quantityLabel,unitLabel} from '../../utils/sellingDetails';
import FulfilmentChoices from '../../components/FulfilmentChoices';
import MenuPhoto from '../../components/MenuPhoto';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,ShoppingBag,Minus,Plus,Trash2} from 'lucide-react';
import BasketDeliveryDays from '../../components/BasketDeliveryDays';
import OrderJourney from '../../components/OrderJourney';
import {PageMeta} from '../../components/BusinessLayout';
import {deliveryDaysText,deliveryDayIssue} from '../../utils/deliveryDays';
import {offeredDatesText,cutoffText} from '../../utils/preorderWindows';
import {useEffect} from 'react';
import {useUI} from '../../contexts/UIContext';
import {useCart} from '../../contexts/CartContext';
import './CartPage.css';

function BasketItemDetails({product}){
 const details=product.selling_details;
 if(!details?.contents&&!product.delivery_weekdays?.length&&!product.delivery_dates?.length&&!product.order_cutoff_time)return null;
 return <details className="cart-item-details"><summary>Item details</summary>
  {details?.contents&&<p>In each {unitLabel(details)}: {details.contents}</p>}
  {product.delivery_weekdays?.length>0&&<p>{deliveryDaysText(product.delivery_weekdays)}</p>}
  {product.delivery_dates?.length>0&&<p>Offered dates: {offeredDatesText(product.delivery_dates)}</p>}
  {product.order_cutoff_time&&<p>{cutoffText(product)}</p>}
 </details>;
}

export default function CartPage(){
 const {formatPrice}=useUI();
 const {cart,cartLoading,cartError,cartUpdating,pricingReady,pricingError,refreshPricing,refreshCart,removeFromCart,updateQuantity,total,discount,SHIPPING_FEE,finalTotal,promotion,fulfilmentMethod='standard',deliveryArea='',chooseFulfilment,pricingRefreshing=false}=useCart();
 const navigate=useNavigate();
 const simple=promotion?.ordering_mode==='simple',foodTotal=total-discount,shownTotal=simple?foodTotal:finalTotal;
 useEffect(()=>{refreshPricing?.();},[refreshPricing]);
 const updating=cartLoading || cartUpdating;
 const count=cart.reduce((n,i)=>n+i.quantity,0);
 const unavailable=cart.some(item=>shippingEnquiry(item.product.selling_details) || item.product.selling_status && item.product.selling_status!=='active');
 const incompatibleDays=Boolean(deliveryDayIssue(cart,''));
 return <main className="cart-container cart-storefront">
  <PageMeta title="Your basket" description="Review your food and continue to choose a time at checkout."/>
  <OrderJourney current="cart"/>
  <div className="cart-page-heading"><div><h1 className="cart-title">Your basket</h1><p>Review your food before checkout.</p></div><Link to="/menu"><ArrowLeft size={16} aria-hidden="true"/>Keep exploring</Link></div>
  {cartLoading && <p role="status">Loading your basket…</p>}
  {cartError && <p role="alert">{cartError} <button onClick={refreshCart}>Retry basket</button></p>}
  {!cartError && unavailable && <p role="alert" className="cart-unavailable">Some items need a separate shipping enquiry or are no longer accepting orders. Remove them from this basket to continue with local preorders.</p>}
  {!cartError && cart.length>0?<div className="cart-layout"><div className="cart-main">
   <section className="cart-choices" aria-labelledby="cart-choices-title"><div className="cart-section-heading"><h2 id="cart-choices-title">Your choices</h2><span>{count} {count===1?'item':'items'}</span></div>
    {updating && <p role="status" className="basket-update-status">Updating basket and totals…</p>}{cart.map(item=><article key={item.id} className="cart-item">
     <div className="cart-left"><div className="cart-image-wrapper"><ShoppingBag size={26} aria-hidden="true"/>{item.product.image_url && <MenuPhoto onError={event=>{event.currentTarget.hidden=true;}} sizes="100px" loading="lazy" src={item.product.image_url} alt="" className="cart-item-image"/>}</div><div className="cart-item-info"><Link to={`/products/${item.product.id}`} className="cart-item-name">{item.product.name}</Link><SellingDetails details={item.product.selling_details} compact/>{shippingEnquiry(item.product.selling_details) && <p><Link to={shippingContact(item.product.id)}>Agree shipping with the kitchen</Link> · Remove this offer from local checkout.</p>}{item.product.selling_status && item.product.selling_status!=='active' && <p className="cart-unavailable-label">Orders unavailable · Please remove this item</p>}<p className="cart-item-price">{formatPrice(item.product.price)} / {unitLabel(item.product.selling_details)}</p><BasketItemDetails product={item.product}/></div></div>
     <div className="cart-right"><div className="qty-controls" role="group" aria-label={`Quantity of ${item.product.name}`}><button className="qty-btn" aria-label={`Decrease quantity of ${item.product.name}`} disabled={item.quantity<=1 || updating} onClick={()=>updateQuantity(item.id,Math.max(1,item.quantity-1))}><Minus size={15}/></button><span className="qty-number" aria-live="polite" aria-label={quantityLabel(item.product.selling_details,item.quantity)}>{item.quantity}</span><button className="qty-btn" aria-label={`Increase quantity of ${item.product.name}`} disabled={updating || shippingEnquiry(item.product.selling_details) || item.quantity>=10000 || Boolean(item.product.selling_status && item.product.selling_status!=='active')} onClick={()=>updateQuantity(item.id,item.quantity+1)}><Plus size={15}/></button></div><strong className="cart-line-total">{formatPrice(item.product.price*item.quantity)}</strong><button className="remove-btn" disabled={updating} aria-label={`Remove ${item.product.name} from basket`} onClick={()=>removeFromCart(item.id)}><Trash2 size={16} aria-hidden="true"/><span>Remove</span></button></div>
    </article>)}
   </section>
   {!simple&&<FulfilmentChoices detailsAtCheckout store={promotion} value={fulfilmentMethod} area={deliveryArea} onChange={chooseFulfilment} onRefresh={refreshPricing} refreshing={pricingRefreshing} disabled={updating || !pricingReady}/>} {simple&&<p className="cart-time-note">Choose how and when to receive your food at checkout.</p>}{!unavailable && <BasketDeliveryDays cart={cart} showBasketLink={false}/>}
   {!simple && !unavailable && !incompatibleDays && <p className="cart-time-note">Choose your {fulfilmentMethod==='pickup'?'collection':'delivery'} time at checkout.</p>}

  </div><aside className="cart-summary" aria-busy={updating} aria-labelledby="cart-summary-title"><span className="cart-summary-icon"><ShoppingBag size={23} aria-hidden="true"/></span><h2 id="cart-summary-title">Order summary</h2><p>{cart.length} {cart.length===1?'choice':'choices'} · {count} {count===1?'item':'items'}</p>{!pricingReady?<div className="basket-pricing-status" role={pricingError?'alert':'status'}><p>{pricingError?'Kitchen pricing could not be loaded. Retry before checkout.':'Loading kitchen pricing…'}</p>{pricingError && <button type="button" onClick={refreshPricing}>Retry pricing</button>}</div>:<dl><div><dt>Food subtotal</dt><dd>{formatPrice(total)}</dd></div>{discount>0 && <div className="cart-discount"><dt>Bulk discount</dt><dd>−{formatPrice(discount)}</dd></div>}{!simple&&<div><dt>{fulfilmentMethod==='pickup'?'Collection':'Delivery fee'}</dt><dd>{SHIPPING_FEE?formatPrice(SHIPPING_FEE):'Free'}</dd></div>}<div className="cart-bill-total"><dt>{simple?'Food total':'Total'}</dt><dd>{formatPrice(shownTotal)}</dd></div></dl>}<p className="cart-summary-note">Choose delivery or collection, a time and payment at checkout.</p>{simple?<p className="cart-summary-note">Delivery fees are added after you choose an area at checkout. Self-collection has no delivery fee.</p>:fulfilmentMethod!=='pickup' && <p className="cart-summary-note">Delivery is arranged by the kitchen. The shown shop fee is included in the total; it is not a live courier quote.</p>}<div className="cart-checkout-action order-action-bar"><div className="cart-mobile-total"><span>{simple?'Food total':'Total'}</span><strong>{updating?'Updating…':pricingReady?formatPrice(shownTotal):'Checking…'}</strong></div><button className="checkout-btn" disabled={unavailable || incompatibleDays || updating || !pricingReady || Boolean(cartError)} onClick={()=>navigate('/checkout')}>Continue to checkout <ArrowRight size={18} aria-hidden="true"/></button></div><Link className="cart-add-more" to="/menu"><Plus size={16} aria-hidden="true"/>Add something else</Link></aside></div>:!cartLoading && !cartError && <section className="cart-empty"><ShoppingBag size={42} aria-hidden="true"/><h2>A good meal is a few clicks away.</h2><p>Your basket is empty. Find something you fancy from the kitchen.</p><Link to="/menu" className="dk-primary">Explore the menu <ArrowRight size={17} aria-hidden="true"/></Link></section>}
 </main>;
}
