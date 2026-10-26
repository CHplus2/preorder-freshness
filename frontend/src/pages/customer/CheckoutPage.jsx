import useOrderEmail from '../../hooks/useOrderEmail';
import DeliveryEmailChoice from '../../components/DeliveryEmailChoice';
import {shippingEnquiry,shippingContact} from '../../utils/sellingDetails';
import SellingDetails from '../../components/SellingDetails';
import {quantityLabel} from '../../utils/sellingDetails';
import FulfilmentChoices from '../../components/FulfilmentChoices';
import {fulfilmentKey,methodsFor} from '../../utils/fulfilment';
import CheckoutAddress from '../../components/CheckoutAddress';
import useCheckoutAddress from '../../hooks/useCheckoutAddress';
import usePayPalConfig from '../../hooks/usePayPalConfig';
import useEscrowConfig from '../../hooks/useEscrowConfig';
import OrderJourney from '../../components/OrderJourney';
import BasketDeliveryDays from '../../components/BasketDeliveryDays';
import {deliveryDaysText,deliveryDayIssue} from '../../utils/deliveryDays';
import PaymentOptions from '../../components/PaymentOptions';
import AvailabilityResult from '../../components/AvailabilityResult';
import DeliveryTimePicker from '../../components/DeliveryTimePicker';
import useDeliveryQuote from '../../hooks/useDeliveryQuote';
import {useAuth} from '../../contexts/AuthContext';
import {accountChanged} from '../../utils/sessionScope';
import {apiError} from '../../utils/apiError';
import {useEffect,useState,useRef} from 'react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {CalendarDays,CreditCard,ChevronLeft} from 'lucide-react';
import axios from 'axios';
import {useUI} from '../../contexts/UIContext';
import {useCart} from '../../contexts/CartContext';
import {useOrder} from '../../contexts/OrderContext';
import {getCookie} from '../../utils/cookieUtils';
import {basketAvailabilityKey} from '../../utils/deliverySlots';
import './CheckoutPage.css';
import './CustomerExperience.css';
const errorText=apiError;
export default function CheckoutPage(){
 const {isSessionCurrent}=useAuth();
 const location=useLocation();
 const orderEmail=useOrderEmail();
 const [emailReminder,setEmailReminder]=useState(false);
 const {config:paypalConfig,error:paypalError,retry:retryPayPal}=usePayPalConfig();
 const escrowConfig=useEscrowConfig();
 const [requestMode,setRequestMode]=useState(false);
 const [submitError,setSubmitError]=useState(null);

 const deliveryAddress=useCheckoutAddress();
 const {address,editing,addressLoading,saving}=deliveryAddress;
 const [loading,setLoading]=useState(false),submitPending=useRef(false),submitErrorRef=useRef(null);
 const [form,setForm]=useState(()=>{let preferred=location.state?.preferredDelivery || '';try{preferred=location.state?.preferredDelivery ?? sessionStorage.getItem('preferredDelivery') ?? '';}catch{/* The current checkout can still work without a saved choice. */}const stamp=Date.parse(preferred);return {delivery_at:Number.isFinite(stamp) && stamp>Date.now()?new Date(stamp+8*3600000).toISOString().slice(0,16):'',payment:'cod'}});
 const {formatPrice}=useUI();const {cart,cartLoading,cartError,cartUpdating,pricingReady,pricingError,refreshPricing,refreshCart,total,SHIPPING_FEE,finalTotal,discount,promotion,fulfilmentMethod='standard',deliveryArea='',chooseFulfilment}=useCart();const {placeOrder}=useOrder();const navigate=useNavigate();
 useEffect(()=>{refreshCart();},[refreshCart]);

 const pickup=fulfilmentMethod==='pickup';
 const areaIssue=!pickup && promotion?.delivery_areas?.length>0 && !promotion.delivery_areas.includes(deliveryArea);
 const weekdayIssue=deliveryDayIssue(cart,form.delivery_at);
 const quoteKey=JSON.stringify([form.delivery_at,basketAvailabilityKey(cart),fulfilmentKey(promotion,fulfilmentMethod,deliveryArea)]);
 const {quote,checking,error:quoteError,retryable,retry:retryQuote}=useDeliveryQuote({deliveryAt:form.delivery_at,selectionKey:quoteKey,
  method:fulfilmentMethod,area:deliveryArea,enabled:!areaIssue && cart.length>0 && !cartLoading && !cartUpdating && !cartError && !cart.some(i=>i.product.selling_status && i.product.selling_status!=='active'),issue:weekdayIssue});
 const chooseTime=value=>{
  setForm(current=>({...current,delivery_at:value}));
  try{if(value)sessionStorage.setItem('preferredDelivery',value+':00+08:00');else sessionStorage.removeItem('preferredDelivery');}catch{/* Keep the current form usable even when saving the choice is unavailable. */}
 };
 useEffect(()=>{if(submitError?.selectionKey===quoteKey && submitErrorRef.current){submitErrorRef.current.focus();submitErrorRef.current.scrollIntoView({block:'nearest'});}},[submitError,quoteKey]);
 const needsReview=quote?.plan.needs_review===true;
 const paymentAvailable=needsReview || (form.payment==='escrow'?!pickup && escrowConfig?.enabled===true:form.payment==='paypal'?paypalConfig?.enabled===true:form.payment==='manual'?promotion?.manual_payment_enabled===true:['cod','wallet'].includes(form.payment));
 const submit=async e=>{
  e.preventDefault();if((!pickup && (!address || editing || saving)) || areaIssue || submitPending.current || cartLoading || cartUpdating || !pricingReady || !paymentAvailable || checking || !quote || quoteError || (quote.plan.needs_review && !requestMode))return;
  if(weekdayIssue)return;
  submitPending.current=true;setLoading(true);setSubmitError(null);
  try {
   sessionStorage.setItem('deliveryPlan',JSON.stringify({delivery_at:form.delivery_at+':00+08:00',delivery_method:fulfilmentMethod,delivery_area:deliveryArea,email_reminder:emailReminder && !!orderEmail?.email && orderEmail.available}));
   if(needsReview || form.payment!=='wallet'){
    const placed=await placeOrder(address?.id ?? null,needsReview?'cod':form.payment,{throwOnError:true});
    if(placed.payment_method==='paypal' && !placed.needs_review){navigate('/payment/paypal?order='+placed.order_id);return;}
    if(placed.payment_method==='escrow' && !placed.needs_review){navigate('/payment/escrow?order='+placed.order_id);return;}
    navigate('/orders',{state:{formPayment:true,requestNeedsReview:placed.needs_review===true}});
   }else{
    // Route planning review requests to unpaid checkout before presenting payment.
    const checked = await axios.post('/api/orders/quote/',{delivery_at:form.delivery_at+':00+08:00',delivery_method:fulfilmentMethod,delivery_area:deliveryArea},{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
    if(!isSessionCurrent())throw accountChanged();
    if(checked.data?.needs_review){
     await placeOrder(address?.id ?? null,'cod',{throwOnError:true});
     navigate('/orders',{state:{formPayment:true,requestNeedsReview:true}});
     return;
    }
    try{localStorage.setItem('addressId',address?.id ?? '');}catch{/* Navigation state still carries this address to the demo wallet. */}
    navigate('/payment/wallet',{state:{addressId:address?.id ?? null}});
   }
  }catch(e){setSubmitError({selectionKey:quoteKey,message:errorText(e)});}finally{submitPending.current=false;setLoading(false);}
 };

 if(cartLoading && !cart.length)return <main className="checkout-container checkout-empty"><h1>Checkout</h1><p role="status">Loading your basket…</p></main>;
 if(cartError)return <main className="checkout-container checkout-empty"><h1>Checkout</h1><p role="alert">{cartError}</p><button onClick={refreshCart}>Retry loading basket</button></main>;
 if(!cart.length)return <main className="checkout-container checkout-empty"><h1>Your basket is empty</h1><p>Add something from the menu before checking out.</p><Link className="dk-primary" to="/menu">Explore the menu</Link></main>;
 if(!pricingReady)return <main className="checkout-container checkout-empty"><h1>Checkout</h1><p role={pricingError?'alert':'status'}>{pricingError?'Kitchen pricing could not be loaded. Retry before checkout.':'Loading kitchen pricing…'}</p>{pricingError && <button type="button" onClick={refreshPricing}>Retry pricing</button>}<Link className="checkout-back" to="/cart">Back to basket</Link></main>;
 if(!methodsFor(promotion).length)return <main className="checkout-container checkout-empty"><h1>Ordering is currently closed</h1><p>The kitchen is not accepting delivery or collection orders right now.</p><Link to="/contact">Contact the kitchen</Link></main>;
 if(cart.some(i=>shippingEnquiry(i.product.selling_details)))return <main className="checkout-container checkout-empty"><h1>Shipping needs a separate agreement</h1><p>These offers have dispatch windows, not local delivery slots. Agree courier, fees and arrival estimates before paying.</p>{cart.filter(i=>shippingEnquiry(i.product.selling_details)).map(i=><p key={i.id}><Link to={shippingContact(i.product.id)}>{i.product.name}: ask about shipping</Link></p>)}<Link to="/cart">Review basket</Link></main>;
 if(cart.some(i=>i.product.selling_status && i.product.selling_status!=='active'))return <main className="checkout-container checkout-empty"><h1>Review your basket</h1><p role="alert">Some items are no longer accepting orders. Remove them from your basket before checking out.</p><ul>{cart.filter(i=>i.product.selling_status && i.product.selling_status!=='active').map(i=><li key={i.id}>{i.product.name}</li>)}</ul><Link className="dk-primary" to="/cart">Review basket</Link></main>;
 return <main className="checkout-container"><OrderJourney current="checkout"/><Link to="/cart" className="checkout-back"><ChevronLeft size={16}/>Back to basket</Link><h1 className="checkout-title">Checkout</h1><p className="checkout-intro">Choose collection or delivery, check a time, and place your preorder.</p>{submitError?.selectionKey===quoteKey && <div role="alert" className="checkout-error" ref={submitErrorRef} tabIndex={-1}><p>{submitError.message}</p><Link to="/orders">Check My orders before retrying</Link></div>}<div className="checkout-grid"><div className="checkout-main">
 <FulfilmentChoices store={promotion} value={fulfilmentMethod} area={deliveryArea} disabled={loading} onChange={(method,area)=>{chooseFulfilment(method,area);if(method!==fulfilmentMethod){setForm(current=>({...current,delivery_at:''}));setRequestMode(false);}}}/>{!pickup && <CheckoutAddress value={deliveryAddress} disabled={loading}/>}
 <form onSubmit={submit} className="checkout-form"><section className="checkout-section"><div className="checkout-section-heading"><CalendarDays size={21}/><h2>{pickup?'Collection time':'Delivery time'}</h2></div><DeliveryTimePicker method={fulfilmentMethod} cart={cart} value={form.delivery_at} disabled={loading || cartLoading || cartUpdating} onSelect={chooseTime} allowRequest requestMode={requestMode} onRequestMode={setRequestMode} selectionUnavailable={quote?.plan.needs_review===true} refreshKey={!requestMode && quote?.plan.needs_review?quote.selectionKey:''}/><BasketDeliveryDays cart={cart} value={requestMode?form.delivery_at:''}/><AvailabilityResult checking={checking} error={quoteError} quote={quote} selectionKey={quoteKey} requestMode={requestMode}/>{retryable && <button type="button" onClick={retryQuote}>Retry availability check</button>}{quote?.plan.needs_review && !requestMode && <button type="button" disabled={loading} onClick={()=>setRequestMode(true)}>Ask kitchen to review this time</button>}</section>
 <section className="checkout-section"><div className="checkout-section-heading"><CreditCard size={21}/><h2>Payment</h2></div>{needsReview?<div className="checkout-payment-deferred" role="status"><strong>Payment after kitchen confirmation</strong><p>No payment is taken when you send this delivery request. The kitchen must confirm a preparation plan first.</p></div>:<><PaymentOptions value={form.payment} disabled={loading || cartLoading || cartUpdating} onChange={payment=>setForm({...form,payment})} manualEnabled={promotion?.manual_payment_enabled} paypalEnabled={paypalConfig?.enabled} escrowEnabled={!pickup && escrowConfig?.enabled} pickup={pickup}/>{paypalError && <p className="checkout-hint" role="status">PayPal availability could not be checked. Other displayed methods remain available. <button type="button" disabled={loading} onClick={retryPayPal}>Retry PayPal availability</button></p>}{!paymentAvailable && <p role="alert" className="checkout-hint">Choose an available payment method to continue.</p>}</>}</section>
 <DeliveryEmailChoice contact={orderEmail} checked={emailReminder} onChange={setEmailReminder} disabled={loading}/>
 <p className="checkout-hint">Availability is checked again when you place your order. Orders needing kitchen review remain unpaid and their requested time is unconfirmed.</p><div className="checkout-submit-dock order-action-bar"><div className="checkout-mobile-total"><span>Total</span><strong>{formatPrice(finalTotal)}</strong></div><button className="checkout-submit" disabled={loading || checking || cartLoading || cartUpdating || !pricingReady || !paymentAvailable || areaIssue || (!pickup && (saving || addressLoading || !address || editing)) || !!weekdayIssue || !quote || !!quoteError || (quote.plan.needs_review && !requestMode)}>{loading?'Placing order…':quote?.plan.needs_review && !requestMode?'Choose another available time':quote?.plan.needs_review?'Send for kitchen review':form.payment==='escrow'?'Save & continue to escrow':form.payment==='paypal'?'Save & continue to PayPal':form.payment!=='wallet'?`Place preorder · ${formatPrice(finalTotal)}`:'Continue with preorder'}</button></div>{!form.delivery_at && <p className="checkout-hint">Choose a delivery time above to continue.</p>}{!pickup && (!address || editing) && <p className="checkout-hint">Save your delivery address to continue.</p>}</form></div>
 <aside className="checkout-summary"><h2>Your preorder</h2><p className="checkout-hint">{cart.reduce((n,item)=>n+item.quantity,0)} {cart.reduce((n,item)=>n+item.quantity,0)===1?'item':'items'} · <Link to="/cart">Edit basket</Link></p>{(cartLoading || cartUpdating) && <p role="status">Updating basket and totals…</p>}{cart.map(item=><div className="checkout-summary-item" key={item.id}><div><strong>{item.product.name}</strong><span>{quantityLabel(item.product.selling_details,item.quantity)}</span><SellingDetails details={item.product.selling_details}/>{item.product.delivery_weekdays?.length > 0 && <span>{deliveryDaysText(item.product.delivery_weekdays)}</span>}</div><strong>{formatPrice(item.product.price*item.quantity)}</strong></div>)}<dl><div><dt>Food subtotal</dt><dd>{formatPrice(total)}</dd></div>{discount>0 && <div><dt>Bulk discount</dt><dd>−{formatPrice(discount)}</dd></div>}<div><dt>{pickup?'Collection':'Delivery'}</dt><dd>{SHIPPING_FEE?formatPrice(SHIPPING_FEE):'Free'}</dd></div><div className="checkout-total"><dt>Total</dt><dd>{formatPrice(finalTotal)}</dd></div></dl>{!pickup && promotion.free_delivery_minimum_myr!=null && total<Number(promotion.free_delivery_minimum_myr) && <p className="checkout-hint">Add {formatPrice(Number(promotion.free_delivery_minimum_myr)-total)} in food for free delivery.</p>}<p className="checkout-hint">Your order status will appear in My Orders after checkout.</p></aside></div></main>;
}
