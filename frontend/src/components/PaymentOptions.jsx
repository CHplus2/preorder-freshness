export default function PaymentOptions({value,onChange,manualEnabled,paypalEnabled,disabled=false,pickup=false}){
  const option=(id,title,note)=><label className={value===id?'selected':''} key={id}><input type="radio" name="payment" value={id} checked={value===id} onChange={()=>onChange(id)}/><span><strong>{title}</strong><small>{note}</small></span></label>;
  return <fieldset className="checkout-payment-methods" disabled={disabled}><legend>Payment method</legend><div className="payment-options">{pickup && option('cod','Cash at collection','Pay when you collect your order.')}{paypalEnabled && option('paypal','PayPal','Test payment. No real money is transferred.')}{manualEnabled && option('manual','Bank QR / bank transfer','Payment instructions appear after ordering. The owner confirms receipt.')}</div>
    {!pickup && <p className="checkout-hint">Pay before courier handover. Cash on delivery is not available.</p>}
    {!pickup && !paypalEnabled && !manualEnabled && <p role="status" className="checkout-hint">No payment service is currently available for delivery. Contact the kitchen before ordering; the demo wallet below uses test credits only.</p>}
    <details className="checkout-demo-options"><summary>Demo payment tools{value==='wallet'?' — demo wallet selected':''}</summary><p className="checkout-hint">For demonstrations only. No real money is transferred.</p><div className="payment-options">{option('wallet','Demo credit wallet','Uses demonstration credits, not a bank or e-wallet balance.')}</div></details>
  </fieldset>;
}
