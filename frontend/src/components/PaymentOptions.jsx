import {Link} from 'react-router-dom';
export default function PaymentOptions({value,onChange,manualEnabled}){
  const option=(id,title,note)=><label className={value===id?'selected':''} key={id}><input type="radio" name="payment" value={id} checked={value===id} onChange={()=>onChange(id)}/><span><strong>{title}</strong><small>{note}</small></span></label>;
  return <><div className="payment-options">{option('cod','Cash on delivery','Pay when your order arrives.')}{manualEnabled && option('manual','DuitNow QR / bank transfer','Payment instructions appear after ordering. The owner confirms receipt.')}</div>
    <details className="checkout-demo-options"><summary>Demo payment tools{value==='wallet'?' — demo wallet selected':''}</summary><p className="checkout-hint">For demonstrations only. No real money is transferred.</p><div className="payment-options">{option('wallet','Demo credit wallet','Uses demonstration credits, not a bank or e-wallet balance.')}</div><Link to="/escrow-demo">Open testnet escrow demo</Link></details>
  </>;
}
