import CheckoutSummary from '../../components/CheckoutSummary';
import {checkoutNextStep} from '../../utils/checkoutNextStep';
import HandoverFields from '../../components/HandoverFields';
import useOrderEmail from '../../hooks/useOrderEmail';
import DeliveryEmailChoice from '../../components/DeliveryEmailChoice';
import {shippingEnquiry,shippingContact} from '../../utils/sellingDetails';
import FulfilmentChoices from '../../components/FulfilmentChoices';
import {fulfilmentKey,methodsFor} from '../../utils/fulfilment';
import CheckoutAddress from '../../components/CheckoutAddress';
import useCheckoutAddress from '../../hooks/useCheckoutAddress';
import usePayPalConfig from '../../hooks/usePayPalConfig';
import useEscrowConfig from '../../hooks/useEscrowConfig';
import OrderJourney from '../../components/OrderJourney';
import BasketDeliveryDays from '../../components/BasketDeliveryDays';
import {deliveryDayIssue} from '../../utils/deliveryDays';
import PaymentOptions from '../../components/PaymentOptions';
import AvailabilityResult from '../../components/AvailabilityResult';
import DeliveryTimePicker from '../../components/DeliveryTimePicker';
import useDeliveryQuote from '../../hooks/useDeliveryQuote';
import {useAuth} from '../../contexts/AuthContext';
import {accountChanged} from '../../utils/sessionScope';
import {apiError} from '../../utils/apiError';
import {useEffect,useState,useRef} from 'react';
import {Link,useNavigate} from 'react-router-dom';
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
 const orderEmail=useOrderEmail();
 const [emailReminder,setEmailReminder]=useState(false),[dispatchUpdates,setDispatchUpdates]=useState(false),[timeUpdates,setTimeUpdates]=useState(false);
 const [handover,setHandover]=useState({contact_phone:null,contact_method:'phone',mode:'in_person',location:'',notes:''});
 const {config:paypalConfig,error:paypalError,retry:retryPayPal}=usePayPalConfig();
 const escrowConfig=useEscrowConfig();
 const [requestMode,setRequestMode]=useState(false);
 const [submitError,setSubmitError]=useState(null);

 const deliveryAddress=useCheckoutAddress();
 const {address,editing,addressLoading,saving}=deliveryAddress;
 const [loading,setLoading]=useState(false),submitPending=useRef(false),submitErrorRef=useRef(null);
 const [payment,setPayment]=useState('cod');
 const {formatPrice}=useUI();const {cart,cartLoading,cartError,cartUpdating,pricingReady,pricingError,refreshPricing,refreshCart,total,SHIPPING_FEE,finalTotal,discount,promotion,fulfilmentMethod='standard',deliveryArea='',chooseFulfilment,arrivalWindowMinutes=0,chooseArrivalWindow,preferredDelivery='',preferredDeliveryDay='',chooseDeliveryTime}=useCart();const {placeOrder}=useOrder();const navigate=useNavigate();
 const form={delivery_at:preferredDelivery,payment};
 useEffect(()=>{refreshCart();},[refreshCart]);

 const pickup=fulfilmentMethod==='pickup';
 const orderHandover={...handover,contact_phone:handover.contact_phone ?? address?.phone ?? '',mode:pickup?'in_person':handover.mode,location:pickup?'':handover.location};
 const areaIssue=!pickup && promotion?.delivery_areas?.length>0 && !promotion.delivery_areas.includes(deliveryArea);
 const weekdayIssue=deliveryDayIssue(cart,form.delivery_at);
 const quoteKey=JSON.stringify([form.delivery_at,basketAvailabilityKey(cart),fulfilmentKey(promotion,fulfilmentMethod,deliveryArea,arrivalWindowMinutes)]);
 const {quote,checking,error:quoteError,retryable,retry:retryQuote}=useDeliveryQuote({deliveryAt:form.delivery_at,selectionKey:quoteKey,
  method:fulfilmentMethod,area:deliveryArea,windowMinutes:arrivalWindowMinutes,enabled:!areaIssue && cart.length>0 && !cartLoading && !cartUpdating && !cartError && !cart.some(i=>i.product.selling_status && i.product.selling_status!=='active'),issue:weekdayIssue});
 const chooseTime=value=>chooseDeliveryTime(value);
 useEffect(()=>{if(submitError?.selectionKey===quoteKey && submitErrorRef.current){submitErrorRef.current.focus();submitErrorRef.current.scrollIntoView({block:'nearest'});}},[submitError,quoteKey]);
 const needsReview=quote?.plan.needs_review===true;
 const paymentAvailable=needsReview || (form.payment==='escrow'?!pickup && escrowConfig?.enabled===true:form.payment==='paypal'?paypalConfig?.enabled===true:form.payment==='manual'?promotion?.manual_payment_enabled===true:['cod','wallet'].includes(form.payment));
 const nextStep=loading?null:checkoutNextStep({updating:cartLoading || cartUpdating,pickup,areaIssue,addressLoading,addressError:deliveryAddress.error,saving,hasAddress:!!address,addressEditing:editing,weekdayIssue,deliveryAt:form.delivery_at,checking,quoteError,quote,requestMode,paymentAvailable});
 const submit=async e=>{
  e.preventDefault();if((!pickup && (!address || editing || saving)) || areaIssue || submitPending.current || cartLoading || cartUpdating || !pricingReady || !paymentAvailable || checking || !quote || quoteError || (quote.plan.needs_review && !requestMode))return;
  if(weekdayIssue)return;
  submitPending.current=true;setLoading(true);setSubmitError(null);
  try {
   sessionStorage.setItem('deliveryPlan',JSON.stringify({delivery_at:form.delivery_at+':00+08:00',delivery_method:fulfilmentMethod,delivery_area:deliveryArea,arrival_window_minutes:arrivalWindowMinutes,email_reminder:emailReminder && !!orderEmail?.email && orderEmail.available,email_dispatch_updates:!pickup && emailReminder && dispatchUpdates && !!orderEmail?.email && orderEmail.available,email_time_updates:emailReminder && timeUpdates && !!orderEmail?.email && orderEmail.available,handover:orderHandover}));
   if(needsReview || form.payment!=='wallet'){
    const placed=await placeOrder(address?.id ?? null,needsReview?'cod':form.payment,{throwOnError:true});
    if(placed.payment_method==='paypal' && !placed.needs_review){navigate('/payment/paypal?order='+placed.order_id);return;}
    if(placed.payment_method==='escrow' && !placed.needs_review){navigate('/payment/escrow?order='+placed.order_id);return;}
    navigate('/orders',{state:{formPayment:true,requestNeedsReview:placed.needs_review===true}});
   }else{
    // Route planning review requests to unpaid checkout before presenting payment.
    const checked = await axios.post('/api/orders/quote/',{delivery_at:form.delivery_at+':00+08:00',delivery_method:fulfilmentMethod,delivery_area:deliveryArea,arrival_window_minutes:arrivalWindowMinutes},{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
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
 return <main className="checkout-container"><OrderJourney current="checkout"/><Link to="/cart" className="checkout-back"><ChevronLeft size={16}/>Back to basket</Link><h1 className="checkout-title">Checkout</h1><p className="checkout-intro">Review how and when to receive your food, then choose payment.</p>{submitError?.selectionKey===quoteKey && <div role="alert" className="checkout-error" ref={submitErrorRef} tabIndex={-1}><p>{submitError.message}</p><Link to="/orders">Check My orders before retrying</Link></div>}<div className="checkout-grid"><div className="checkout-main">
 <section id="checkout-receive" className="checkout-receive" tabIndex={-1} aria-label="Receive your preorder"><FulfilmentChoices store={promotion} value={fulfilmentMethod} area={deliveryArea} disabled={loading} onChange={(method,area)=>{chooseFulfilment(method,area);if(method!==fulfilmentMethod){setRequestMode(false);}}}/></section>{!pickup && <CheckoutAddress value={deliveryAddress} disabled={loading}/>}
 <form onSubmit={submit} className="checkout-form"><section id="checkout-time" tabIndex={-1} className="checkout-section"><div className="checkout-section-heading"><CalendarDays size={21}/><h2>{pickup?'Collection time':'Delivery time'}</h2></div><DeliveryTimePicker key={basketAvailabilityKey(cart)+fulfilmentKey(promotion,fulfilmentMethod,deliveryArea)} day={preferredDeliveryDay} method={fulfilmentMethod} windowMinutes={arrivalWindowMinutes} onWindowChange={minutes=>{chooseArrivalWindow?.(minutes);chooseTime('');setRequestMode(false);}} cart={cart} value={form.delivery_at} disabled={loading || cartLoading || cartUpdating} onSelect={chooseTime} allowRequest requestMode={requestMode} onRequestMode={setRequestMode} selectionUnavailable={quote?.plan.needs_review===true || Boolean(quoteError && !retryable)} refreshKey={!requestMode && quote?.plan.needs_review?quote.selectionKey:''}/><BasketDeliveryDays cart={cart} value={requestMode?form.delivery_at:''}/><AvailabilityResult checking={checking} error={quoteError} quote={quote} selectionKey={quoteKey} requestMode={requestMode}/>{retryable && <button type="button" onClick={retryQuote}>Retry availability check</button>}{quote?.plan.needs_review && !requestMode && <button type="button" disabled={loading} onClick={()=>setRequestMode(true)}>Ask kitchen to review this time</button>}</section>
 <section id="checkout-payment" tabIndex={-1} className="checkout-section"><div className="checkout-section-heading"><CreditCard size={21}/><h2>Payment</h2></div>{needsReview?<div className="checkout-payment-deferred" role="status"><strong>Payment after kitchen confirmation</strong><p>No payment is taken when you send this delivery request. The kitchen must confirm a preparation plan first.</p></div>:<><PaymentOptions value={form.payment} disabled={loading || cartLoading || cartUpdating} onChange={setPayment} manualEnabled={promotion?.manual_payment_enabled} paypalEnabled={paypalConfig?.enabled} escrowEnabled={!pickup && escrowConfig?.enabled} pickup={pickup}/>{paypalError && <p className="checkout-hint" role="status">PayPal availability could not be checked. Other displayed methods remain available. <button type="button" disabled={loading} onClick={retryPayPal}>Retry PayPal availability</button></p>}{!paymentAvailable && <p role="alert" className="checkout-hint">Choose an available payment method to continue.</p>}</>}</section>
 <details className="checkout-section handover-checkout"><summary>Contact & handover instructions (optional)</summary><HandoverFields value={orderHandover} onChange={setHandover} pickup={pickup} disabled={loading}/></details>
 <DeliveryEmailChoice contact={orderEmail} checked={emailReminder} onChange={setEmailReminder} dispatchUpdates={dispatchUpdates} onDispatchChange={pickup?undefined:setDispatchUpdates} timeUpdates={timeUpdates} onTimeChange={setTimeUpdates} disabled={loading}/>
 <p className="checkout-hint">Availability is checked again when you place your order. Orders needing kitchen review remain unpaid and their requested time is unconfirmed.</p><div className="checkout-submit-dock order-action-bar">{nextStep && <p className="checkout-next-step" role="status">{nextStep.href?<a href={nextStep.href}>{nextStep.message}</a>:nextStep.message}</p>}<div className="checkout-mobile-total"><span>Total</span><strong>{cartLoading || cartUpdating?'Updating…':formatPrice(finalTotal)}</strong></div><button className="checkout-submit" disabled={loading || checking || cartLoading || cartUpdating || !pricingReady || !paymentAvailable || areaIssue || (!pickup && (saving || addressLoading || !address || editing)) || !!weekdayIssue || !quote || !!quoteError || (quote.plan.needs_review && !requestMode)}>{loading?'Placing order…':quote?.plan.needs_review && !requestMode?'Choose another available time':quote?.plan.needs_review?'Send for kitchen review':form.payment==='escrow'?'Save & continue to escrow':form.payment==='paypal'?'Save & continue to PayPal':form.payment!=='wallet'?`Place preorder · ${formatPrice(finalTotal)}`:'Continue with preorder'}</button></div></form></div>
 <CheckoutSummary cart={cart} total={total} discount={discount} shipping={SHIPPING_FEE} finalTotal={finalTotal} pickup={pickup} updating={cartLoading || cartUpdating} freeDeliveryMinimum={promotion.free_delivery_minimum_myr} formatPrice={formatPrice}/></div></main>;
}
