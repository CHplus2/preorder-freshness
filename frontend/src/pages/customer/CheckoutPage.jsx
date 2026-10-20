import usePayPalConfig from '../../hooks/usePayPalConfig';
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
import {useEffect,useState} from 'react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {MapPin,CalendarDays,CreditCard,Check,ChevronLeft} from 'lucide-react';
import axios from 'axios';
import {useUI} from '../../contexts/UIContext';
import {useCart} from '../../contexts/CartContext';
import {useOrder} from '../../contexts/OrderContext';
import {getCookie} from '../../utils/cookieUtils';
import './CheckoutPage.css';
const emptyAddress={recipient_name:'',line1:'',line2:'',city:'',state:'',postal_code:'',country:'Malaysia',phone:''};
const states=['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Labuan','Putrajaya'];
const errorText=apiError;
export default function CheckoutPage(){
 const {isSessionCurrent}=useAuth();
 const location=useLocation();
 const {config:paypalConfig}=usePayPalConfig();
 const [requestMode,setRequestMode]=useState(false);
 const [submitError,setSubmitError]=useState(null);

 const [address,setAddress]=useState(null),[draft,setDraft]=useState(emptyAddress),[editing,setEditing]=useState(false),[addressLoading,setAddressLoading]=useState(true),[saving,setSaving]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [form,setForm]=useState(()=>{let preferred=location.state?.preferredDelivery || '';try{preferred=location.state?.preferredDelivery ?? sessionStorage.getItem('preferredDelivery') ?? '';}catch{/* The current checkout can still work without a saved choice. */}const stamp=Date.parse(preferred);return {delivery_at:Number.isFinite(stamp) && stamp>Date.now()?new Date(stamp+8*3600000).toISOString().slice(0,16):'',delivery_method:'standard',payment:'cod'}});
 const {formatPrice}=useUI();const {cart,cartLoading,cartError,refreshCart,total,SHIPPING_FEE,finalTotal,discount,promotion}=useCart();const {placeOrder}=useOrder();const navigate=useNavigate();
 useEffect(()=>{refreshCart();},[refreshCart]);
 useEffect(()=>{let active=true;axios.get('/api/address/').then(r=>{if(active){setAddress(r.data);setDraft(r.data || emptyAddress);setEditing(!r.data);}}).catch(e=>{if(active)setError(errorText(e));}).finally(()=>{if(active)setAddressLoading(false);});return()=>{active=false};},[]);
 const weekdayIssue=deliveryDayIssue(cart,form.delivery_at);
 const quoteKey=JSON.stringify([form.delivery_at,cart.map(i=>[i.id,i.quantity,i.product.updated_at,i.product.delivery_weekdays,i.product.lead_hours,i.product.daily_capacity,i.product.max_early_minutes,i.product.max_preparation_days,i.product.preparation_tasks]),promotion?.delivery_buffer_minutes]);
 const {quote,checking,error:quoteError,retryable,retry:retryQuote}=useDeliveryQuote({deliveryAt:form.delivery_at,selectionKey:quoteKey,
  enabled:cart.length>0 && !cartLoading && !cartError && !cart.some(i=>i.product.selling_status && i.product.selling_status!=='active'),issue:weekdayIssue});
 const chooseTime=value=>{
  setForm(current=>({...current,delivery_at:value}));
  try{if(value)sessionStorage.setItem('preferredDelivery',value+':00+08:00');else sessionStorage.removeItem('preferredDelivery');}catch{/* Keep the current form usable even when saving the choice is unavailable. */}
 };
 const saveAddress=async e=>{e.preventDefault();setSaving(true);setError('');try{const r=await axios.put('/api/address/',draft,{headers:{'X-CSRFToken':getCookie('csrftoken')}});setAddress(r.data);setDraft(r.data);setEditing(false);}catch(e){setError(errorText(e));}finally{setSaving(false);}};
 const submit=async e=>{
  e.preventDefault();if(!address || editing || loading || cartLoading || checking || !quote || quoteError || (quote.plan.needs_review && !requestMode))return;
  if(weekdayIssue){setError(weekdayIssue);return;}
  setLoading(true);setError('');setSubmitError(null);
  try {
   sessionStorage.setItem('deliveryPlan',JSON.stringify({delivery_at:form.delivery_at+':00+08:00',delivery_method:form.delivery_method}));
   if(form.payment!=='wallet'){
    const placed=await placeOrder(address.id,form.payment,{throwOnError:true});
    if(placed.payment_method==='paypal' && !placed.needs_review){navigate('/payment/paypal?order='+placed.order_id);return;}
    navigate('/orders',{state:{formPayment:true,requestNeedsReview:placed.needs_review===true}});
   }else{
    // Route planning review requests to unpaid checkout before presenting payment.
    const checked = await axios.post('/api/orders/quote/',{delivery_at:form.delivery_at+':00+08:00'},{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
    if(!isSessionCurrent())throw accountChanged();
    if(checked.data?.needs_review){
     await placeOrder(address.id,'cod',{throwOnError:true});
     navigate('/orders',{state:{formPayment:true,requestNeedsReview:true}});
     return;
    }
    localStorage.setItem('addressId',address.id);
    navigate('/payment/wallet',{state:{addressId:address.id}});
   }
  }catch(e){setSubmitError({selectionKey:quoteKey,message:errorText(e)});}finally{setLoading(false);}
 };

 if(cartLoading && !cart.length)return <main className="checkout-container checkout-empty"><h1>Checkout</h1><p role="status">Loading your basket…</p></main>;
 if(cartError)return <main className="checkout-container checkout-empty"><h1>Checkout</h1><p role="alert">{cartError}</p><button onClick={refreshCart}>Retry loading basket</button></main>;
 if(!cart.length)return <main className="checkout-container checkout-empty"><h1>Your basket is empty</h1><p>Add something from the menu before checking out.</p><Link className="dk-primary" to="/menu">Explore the menu</Link></main>;
 if(cart.some(i=>i.product.selling_status && i.product.selling_status!=='active'))return <main className="checkout-container checkout-empty"><h1>Review your basket</h1><p role="alert">Some items are no longer accepting orders. Remove them from your basket before checking out.</p><ul>{cart.filter(i=>i.product.selling_status && i.product.selling_status!=='active').map(i=><li key={i.id}>{i.product.name}</li>)}</ul><Link className="dk-primary" to="/cart">Review basket</Link></main>;
 return <main className="checkout-container"><OrderJourney current="checkout"/><Link to="/cart" className="checkout-back"><ChevronLeft size={16}/>Back to basket</Link><h1 className="checkout-title">Checkout</h1><p className="checkout-intro">Confirm your address, choose a delivery time, and place your preorder.</p>{error && <div role="alert" className="checkout-error">{error}</div>}{submitError?.selectionKey===quoteKey && <div role="alert" className="checkout-error">{submitError.message}</div>}<div className="checkout-grid"><div className="checkout-main">
 <section className="checkout-section"><div className="checkout-section-heading"><MapPin size={21}/><h2>Delivery address</h2><Link to="/account">Account settings</Link>{address && !editing && <button type="button" onClick={()=>setEditing(true)}>Change</button>}</div>
 {addressLoading?<p role="status">Loading your saved address…</p>:editing?<form className="address-form" onSubmit={saveAddress}><p className="checkout-hint">Save once. We’ll use this address for your next orders too.</p><div className="address-fields">{[['recipient_name','Recipient name','name'],['phone','Phone number','tel'],['line1','Street address','address-line1'],['line2','Apartment, floor or unit (optional)','address-line2'],['city','City','address-level2'],['postal_code','Postcode','postal-code']].map(([key,label,auto])=><label key={key} className={['line1','line2'].includes(key)?'field-wide':''}>{label}<input type={key==='phone'?'tel':'text'} autoComplete={auto} required={key!=='line2'} pattern={key==='postal_code'?'[0-9]{5}':undefined} maxLength={key==='postal_code'?5:key==='phone'?20:150} value={draft[key] || ''} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}<label>State / territory<select required autoComplete="address-level1" value={draft.state} onChange={e=>setDraft({...draft,state:e.target.value})}><option value="">Select a state</option>{states.map(s=><option key={s}>{s}</option>)}</select></label><label>Country<input value="Malaysia" readOnly autoComplete="country-name"/></label></div><div className="checkout-actions"><button className="checkout-submit" disabled={saving}>{saving?'Saving…':'Save delivery address'}</button>{address && <button type="button" onClick={()=>{setDraft(address);setEditing(false)}}>Cancel</button>}</div></form>:address?<div className="saved-address"><span className="address-default"><Check size={14}/>Saved address</span><strong>{address.recipient_name || 'Delivery recipient'}</strong><p>{address.phone}</p><p>{address.line1}{address.line2 && <><br/>{address.line2}</>}<br/>{address.postal_code} {address.city}, {address.state}<br/>{address.country}</p><p className="checkout-hint">Changing your saved address won’t alter orders already placed.</p></div>:<button onClick={()=>setEditing(true)}>Add delivery address</button>}</section>
 <form onSubmit={submit} className="checkout-form"><section className="checkout-section"><div className="checkout-section-heading"><CalendarDays size={21}/><h2>Delivery time</h2></div><DeliveryTimePicker cart={cart} value={form.delivery_at} disabled={loading || cartLoading} onSelect={chooseTime} allowRequest requestMode={requestMode} onRequestMode={setRequestMode} selectionUnavailable={quote?.plan.needs_review===true} refreshKey={!requestMode && quote?.plan.needs_review?quote.selectionKey:''}/><BasketDeliveryDays cart={cart} value={requestMode?form.delivery_at:''}/><AvailabilityResult checking={checking} error={quoteError} quote={quote} selectionKey={quoteKey} requestMode={requestMode}/>{retryable && <button type="button" onClick={retryQuote}>Retry availability check</button>}{quote?.plan.needs_review && !requestMode && <button type="button" disabled={loading} onClick={()=>setRequestMode(true)}>Ask kitchen to review this time</button>}<label>Delivery service<select value={form.delivery_method} disabled={loading} onChange={e=>setForm({...form,delivery_method:e.target.value})}><option value="standard">Owner delivery</option><option value="express">Request express delivery</option></select><span className="checkout-hint">{form.delivery_method==='express'?'The owner must confirm courier availability and any extra charge.':'The owner confirms your requested delivery arrangements.'}</span></label></section>
 <section className="checkout-section"><div className="checkout-section-heading"><CreditCard size={21}/><h2>Payment</h2></div><PaymentOptions value={form.payment} onChange={payment=>setForm({...form,payment})} manualEnabled={promotion?.manual_payment_enabled} paypalEnabled={paypalConfig?.enabled}/></section>
 <p className="checkout-hint">Availability is checked again when you place your order. Orders needing kitchen review remain unpaid and their requested time is unconfirmed.</p><div className="checkout-submit-dock order-action-bar"><div className="checkout-mobile-total"><span>Total</span><strong>{formatPrice(finalTotal)}</strong></div><button className="checkout-submit" disabled={loading || checking || cartLoading || addressLoading || !address || editing || !!weekdayIssue || !quote || !!quoteError || (quote.plan.needs_review && !requestMode)}>{loading?'Placing order…':quote?.plan.needs_review && !requestMode?'Choose another available time':quote?.plan.needs_review?'Send for kitchen review':form.payment==='paypal'?'Save preorder & continue to PayPal Sandbox':form.payment!=='wallet'?`Place preorder · ${formatPrice(finalTotal)}`:'Continue with preorder'}</button></div>{!form.delivery_at && <p className="checkout-hint">Choose a delivery time above to continue.</p>}{(!address || editing) && <p className="checkout-hint">Save your delivery address to continue.</p>}</form></div>
 <aside className="checkout-summary"><h2>Your preorder</h2>{cart.map(item=><div className="checkout-summary-item" key={item.id}><div><strong>{item.product.name}</strong><span>Quantity: {item.quantity}</span>{item.product.delivery_weekdays?.length > 0 && <span>{deliveryDaysText(item.product.delivery_weekdays)}</span>}</div><strong>{formatPrice(item.product.price*item.quantity)}</strong></div>)}<dl><div><dt>Food subtotal</dt><dd>{formatPrice(total)}</dd></div>{discount>0 && <div><dt>Bulk discount</dt><dd>−{formatPrice(discount)}</dd></div>}<div><dt>Delivery</dt><dd>{SHIPPING_FEE?formatPrice(SHIPPING_FEE):'Free'}</dd></div><div className="checkout-total"><dt>Total</dt><dd>{formatPrice(finalTotal)}</dd></div></dl>{total<50 && <p className="checkout-hint">Add {formatPrice(50-total)} in food for free delivery.</p>}<p className="checkout-hint">Your order status will appear in My Orders after checkout.</p></aside></div></main>;
}
