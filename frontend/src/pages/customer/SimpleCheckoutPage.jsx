import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useAuth} from '../../contexts/AuthContext';
import {useCart} from '../../contexts/CartContext';
import {useOrder} from '../../contexts/OrderContext';
import {useUI} from '../../contexts/UIContext';
import {manualPaymentAvailable,confirmedCheckoutPrice} from '../../utils/checkoutPayment';
import {apiError} from '../../utils/apiError';
import FulfilmentChoices from '../../components/FulfilmentChoices';
import DeliveryTimePicker from '../../components/DeliveryTimePicker';
import AvailabilityResult from '../../components/AvailabilityResult';
import CheckoutSummary from '../../components/CheckoutSummary';
import CheckoutProofUpload from '../../components/CheckoutProofUpload';
import useDeliveryQuote from '../../hooks/useDeliveryQuote';
import {basketAvailabilityKey} from '../../utils/deliverySlots';
import {fulfilmentKey,fulfilmentSelectionKey,methodsFor} from '../../utils/fulfilment';
import './CheckoutPage.css';
import './SimpleCheckoutPage.css';

export default function SimpleCheckoutPage(){
 const {cart,cartLoading,cartError,cartUpdating,pricingReady,pricingError,refreshCart,refreshPricing,promotion,pricingRefreshing=false,
  fulfilmentMethod='standard',deliveryArea='',chooseFulfilment,preferredDelivery='',preferredDeliveryDay='',chooseDeliveryTime,
  total,discount,SHIPPING_FEE,finalTotal}=useCart();
 const {isSessionCurrent,customerAccount,isGuest,isAdmin}=useAuth(),{placeOrder}=useOrder(),{formatPrice,openCustomerAccess}=useUI(),navigate=useNavigate();
 const [enteredName,setName]=useState(''),[enteredPhone,setPhone]=useState(''),[address,setAddress]=useState(''),[notes,setNotes]=useState('');
 const name=customerAccount?.name??enteredName,phone=customerAccount?.phone??enteredPhone;
 const [payment,setPayment]=useState(''),[proof,setProof]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [receiptUploaded,setReceiptUploaded]=useState(false);
 const pending=useRef(false),errorRef=useRef(null);
 const pickup=fulfilmentMethod==='pickup',transfer=manualPaymentAvailable(promotion,fulfilmentMethod),qr=!!promotion.duitnow_qr_url;
 const accepting=methodsFor(promotion).length>0;
 const areaIssue=!pickup&&promotion?.delivery_areas?.length>0&&!promotion.delivery_areas.includes(deliveryArea);
 const key=JSON.stringify([preferredDelivery,basketAvailabilityKey(cart),fulfilmentKey(promotion,fulfilmentMethod,deliveryArea,0)]);
 const {quote,checking,error:quoteError,retry:retryQuote,retryable,shortage}=useDeliveryQuote({deliveryAt:preferredDelivery,selectionKey:key,method:fulfilmentMethod,area:deliveryArea,windowMinutes:0,enabled:accepting&&!pricingRefreshing&&!areaIssue&&cart.length>0&&!cartLoading&&!cartUpdating&&!cartError});
 const priceConfirmed=confirmedCheckoutPrice(quote?.plan?.pricing,{total,discount,shipping:SHIPPING_FEE,finalTotal})&&!pricingRefreshing;
 const refreshRequested=useRef('');
 const mismatch=Boolean(quote?.plan?.pricing&&!priceConfirmed&&!pricingRefreshing);
 useEffect(()=>{if(mismatch&&refreshRequested.current!==key){refreshRequested.current=key;refreshPricing?.()}},[mismatch,key,refreshPricing]);
 const proofScope=JSON.stringify([key,finalTotal,promotion.manual_payment_enabled,promotion.duitnow_qr_url,promotion.bank_transfer_instructions]);
 const activeProof=proof?.scope===proofScope?proof:null;
 const [paymentScope,setPaymentScope]=useState(null);
 if(priceConfirmed&&paymentScope!==proofScope)setPaymentScope(proofScope);
 const method=pickup?'manual':payment||(transfer?'manual':'');
 const paymentReady=method==='cod'&&!pickup||method==='manual'&&transfer&&activeProof;
 const submit=async e=>{
  e.preventDefault();if(pending.current||!paymentReady||!quote||!priceConfirmed||quoteError||checking)return;
  pending.current=true;setBusy(true);setError('');
  try{
   if(!isSessionCurrent())throw new Error('Your browser session changed. Reload checkout before continuing.');
   await placeOrder(null,method,{throwOnError:true,body:{
    delivery_at:preferredDelivery+':00+08:00',delivery_method:fulfilmentMethod,delivery_area:deliveryArea,arrival_window_minutes:0,
    customer:{name,phone},delivery_address:pickup?undefined:{line1:address},expected_total:finalTotal.toFixed(2),
    payment_proof_id:method==='manual'?activeProof.id:undefined,
    handover:{mode:'in_person',notes,contact_phone:phone,contact_method:'phone'}
   }});
   navigate('/orders',{state:{formPayment:true}});
  }catch(err){setError(apiError(err));requestAnimationFrame(()=>errorRef.current?.focus());}
  finally{pending.current=false;setBusy(false)}
 };
 if(cartLoading&&!cart.length)return <main className="checkout-container"><h1>Checkout</h1><p role="status">Loading your basket…</p></main>;
 if(cartError||!pricingReady)return <main className="checkout-container"><h1>Checkout</h1><p role="alert">{cartError||pricingError||'Loading kitchen details…'}</p><button onClick={()=>{refreshCart();refreshPricing?.()}}>Refresh checkout</button></main>;
 if(!cart.length)return <main className="checkout-container"><h1>Your basket is empty</h1><Link to="/menu">Browse the menu</Link></main>;
 if(!accepting)return <main className="checkout-container client-checkout"><Link className="checkout-back" to="/cart">Back to basket</Link><h1>Ordering is temporarily unavailable</h1><section className="checkout-section"><p>The kitchen is not offering delivery or self-collection right now. Your basket is kept.</p><Link to="/contact">Contact the kitchen</Link></section></main>;
 if(isGuest)return <main className="checkout-container client-checkout"><Link className="checkout-back" to="/cart">Back to basket</Link><h1>Sign in to place your preorder</h1><section className="checkout-section"><h2>Your basket is ready</h2><p>Create an account with your name, phone number and a passkey, or sign in to an existing account. No email, password or SMS needed.</p><p>Your basket stays with you when you create an account. Signing in loads that account’s basket and orders.</p><button type="button" className="checkout-submit account-checkout-link" onClick={()=>openCustomerAccess({next:'/checkout'})}>Create account or sign in</button><p className="checkout-hint">You’ll choose your time and payment after signing in.</p></section></main>;
 return <main className="checkout-container client-checkout"><Link className="checkout-back" to="/cart">Back to basket</Link><h1>Checkout</h1><p className="checkout-intro">Your food, contact details and preferred time. Your account keeps your orders together.</p>
  <form onSubmit={submit} className="client-checkout-grid">
   <fieldset disabled={busy||cartUpdating} className="client-checkout-main">
    <legend className="sr-only">Preorder details</legend>
    <section className="checkout-section"><FulfilmentChoices store={promotion} value={fulfilmentMethod} area={deliveryArea} onChange={(next,area)=>{chooseFulfilment(next,area);setPayment('');setProof(null)}}/></section>
    <section className="checkout-section"><h2>Your details</h2>{isGuest&&<p className="checkout-hint"><Link to="/account?next=checkout">Create an account or sign in</Link> to keep your orders available on another device.</p>}{customerAccount&&<p className="checkout-hint">Using your account details. <Link to="/account?next=checkout">Edit name or phone</Link></p>}<div className="client-contact-fields"><label>Your name<input required readOnly={!!customerAccount} autoComplete="name" maxLength="150" value={name} onChange={e=>setName(e.target.value)}/></label><label>Phone number<input required readOnly={!!customerAccount} type="tel" autoComplete="tel" maxLength="30" placeholder="e.g. 012 345 6789" value={phone} onChange={e=>setPhone(e.target.value)}/></label></div><p className="checkout-hint">The kitchen uses this number to coordinate your order.</p>
     {!pickup&&<label>Full delivery address<textarea required autoComplete="street-address" rows="3" maxLength="500" placeholder="House / unit, street, town and postcode" value={address} onChange={e=>setAddress(e.target.value)}/></label>}
     <details className="client-extra-notes"><summary>Handover instructions (optional)</summary><label>Instructions for the kitchen<textarea maxLength="500" rows="2" value={notes} onChange={e=>setNotes(e.target.value)}/></label><p className="checkout-hint">Food is handed to a person. Contact the kitchen to agree any unattended delivery.</p></details>
    </section>
    <section className="checkout-section"><h2>{pickup?'Collection time':'Delivery time'}</h2><DeliveryTimePicker key={basketAvailabilityKey(cart)+fulfilmentSelectionKey(promotion,fulfilmentMethod,deliveryArea,0)} value={preferredDelivery} day={preferredDeliveryDay} method={fulfilmentMethod} onSelect={chooseDeliveryTime} windowMinutes={0}/><AvailabilityResult shortage={shortage} onRetry={retryQuote} retryable={retryable} selectionKey={key} deliveryAt={preferredDelivery} checking={checking} quote={quote} error={quoteError}/>{quoteError&&retryable&&!shortage&&<button type="button" onClick={retryQuote}>Retry availability check</button>}</section>
    <section className="checkout-section"><h2>Payment</h2><div className="client-payment-options" role="group" aria-label="Payment method">
     {transfer&&<label className={method==='manual'?'selected':''}><input type="radio" name="client-payment" checked={method==='manual'} onChange={()=>setPayment('manual')}/><span><strong>{pickup?'DuitNow QR':qr?'DuitNow QR / bank transfer':'Bank transfer'}</strong><small>Pay and upload the receipt before placing your order.</small></span></label>}
     {!pickup&&<label className={method==='cod'?'selected':''}><input type="radio" name="client-payment" checked={method==='cod'} onChange={()=>{setPayment('cod');setProof(null)}}/><span><strong>Cash on delivery</strong><small>Pay the kitchen’s agreed amount when you receive your food.</small></span></label>}
    </div>{transfer&&method!=='manual'&&<p className="checkout-hint">Choose {qr?'DuitNow QR / bank transfer':'Bank transfer'} to display payment details and receipt upload.</p>}{pickup&&<p className="checkout-hint">Self-collection accepts QR payment only.</p>}{!transfer&&<p className="checkout-hint">{pickup?'The kitchen has not enabled a receiving QR code for collection. Contact the kitchen before ordering.':'The kitchen has not enabled QR or bank-transfer payment. Cash is available for delivery.'}{isAdmin&&<> <Link to="/admin/settings#qr-payments">Set up receiving payments</Link></>}</p>}
    {receiptUploaded&&!activeProof&&<p role="status" className="checkout-hint">You uploaded a receipt earlier in this checkout. If you already paid, do not pay again. Contact the kitchen if the amount or payment method has changed; otherwise upload your existing receipt for the updated details.</p>}
    {mismatch&&<p role="status" className="checkout-hint">Kitchen pricing changed. Refreshing fees before payment. <button type="button" onClick={refreshPricing}>Refresh pricing</button></p>}
    {method==='manual'&&transfer&&paymentScope!==proofScope&&<p role="status" className="checkout-hint">Choose your area, date and time to confirm the total. The QR code, bank details and receipt upload appear after this check.</p>}
    {method==='manual'&&transfer&&paymentScope===proofScope&&<CheckoutProofUpload confirmed={priceConfirmed&&!checking&&!quoteError} key={proofScope} scope={proofScope} amount={finalTotal} disabled={!priceConfirmed||!!quoteError||checking||busy} selection={{delivery_at:preferredDelivery+':00+08:00',delivery_method:fulfilmentMethod,delivery_area:deliveryArea,arrival_window_minutes:0}} qrUrl={promotion.duitnow_qr_url} instructions={promotion.bank_transfer_instructions} onUploaded={value=>{setProof(value?{...value,scope:proofScope}:null);if(value)setReceiptUploaded(true)}}/>}
    </section>
    {error&&<div ref={errorRef} tabIndex="-1" role="alert" className="checkout-error">{error}</div>}
    <p className="checkout-hint">Stock is checked again and deducted when you place your order. QR or bank-transfer payment is marked paid only after the kitchen verifies it.</p>
    <p className="checkout-hint">{customerAccount?'Your orders are saved to your account. Sign in with your passkey to view them on another device.':<>Guest orders stay private to this browser session. <Link to="/account?next=checkout">Save them with a passkey account</Link> before changing devices or clearing browser data.</>}</p>
    <button className="checkout-submit" disabled={busy||cartLoading||cartUpdating||checking||!quote||!priceConfirmed||!!quoteError||!!areaIssue||!paymentReady}>{busy?'Placing order…':`Place preorder · ${formatPrice(finalTotal)}`}</button>
   </fieldset>
   <CheckoutSummary cart={cart} total={total} discount={discount} shipping={SHIPPING_FEE} finalTotal={finalTotal} pickup={pickup} updating={cartUpdating} freeDeliveryMinimum={promotion.free_delivery_minimum_myr} formatPrice={formatPrice} shippingPending={areaIssue} deliveryArea={deliveryArea} areaFee={Object.hasOwn(promotion.delivery_area_fees||{},deliveryArea)?promotion.delivery_area_fees[deliveryArea]:promotion.delivery_fee_myr}/>
  </form>
 </main>;
}
