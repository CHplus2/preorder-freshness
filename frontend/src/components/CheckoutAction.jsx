export default function CheckoutAction({busy,disabled,confirmed,shippingPending,foodTotal,finalTotal,formatPrice,nextStep}){
 return <div className="client-order-action order-action-bar">
  {nextStep&&<p id="checkout-next-step" role="status" className="client-order-next-step">{nextStep}</p>}
  <div className="client-order-action-row"><div className="client-order-total"><span>{shippingPending?'Food total':confirmed?'Total':'Estimated total'}</span><strong>{formatPrice(shippingPending?foodTotal:finalTotal)}</strong></div>
   <button type="submit" className="checkout-submit" aria-describedby={nextStep?'checkout-next-step':undefined} disabled={disabled}>{busy?'Placing order…':confirmed?`Place preorder · ${formatPrice(finalTotal)}`:'Place preorder'}</button>
  </div>
 </div>;
}
