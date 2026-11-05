import {useSyncExternalStore} from 'react';
import {Link} from 'react-router-dom';
import {ChevronDown} from 'lucide-react';
import MenuPhoto from './MenuPhoto';
import SellingDetails from './SellingDetails';
import {unitLabel} from '../utils/sellingDetails';
import {deliveryDaysText} from '../utils/deliveryDays';

const query='(min-width: 801px)';
const subscribe=listener=>{const media=window.matchMedia(query);media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener);};
const wide=()=>window.matchMedia(query).matches;

export default function CheckoutSummary({cart,total,discount,shipping,finalTotal,pickup=false,updating=false,freeDeliveryMinimum,formatPrice,shippingPending=false}){
 const expanded=useSyncExternalStore(subscribe,wide,()=>true);
 const shownTotal=shippingPending?total-discount:finalTotal;
 const count=cart.reduce((sum,item)=>sum+item.quantity,0);
 return <aside className="checkout-summary" aria-label="Order summary" aria-busy={updating}>
  <details open={expanded}>
   <summary><span><h2>Your preorder</h2><small>{count} {count===1?'item':'items'}<span className="checkout-summary-view"> · View details</span><span className="checkout-summary-hide"> · Hide details</span></small></span><span className="checkout-summary-preview"><strong>{updating?'Updating…':formatPrice(shownTotal)}</strong><ChevronDown size={18} aria-hidden="true"/></span></summary>
   <div className="checkout-summary-body"><Link className="checkout-edit-basket" to="/cart">Edit basket</Link>
    {updating && <p role="status" className="checkout-hint">Updating basket and totals…</p>}
    {cart.map(item=><div className="checkout-summary-item" key={item.id}>
     {item.product.image_url && <MenuPhoto className="checkout-summary-photo" src={item.product.image_url} sizes="48px" alt="" loading="lazy" onError={event=>{event.currentTarget.hidden=true;}}/>}
     <div><strong>{item.product.name}</strong><span>{formatPrice(item.product.price)} / {unitLabel(item.product.selling_details)} × {item.quantity}</span><SellingDetails details={item.product.selling_details} compact/>{item.product.delivery_weekdays?.length>0 && <span>{deliveryDaysText(item.product.delivery_weekdays)}</span>}</div><strong>{formatPrice(item.product.price*item.quantity)}</strong>
    </div>)}
    <dl><div><dt>Food subtotal</dt><dd>{formatPrice(total)}</dd></div>{discount>0 && <div className="checkout-discount"><dt>Bulk discount</dt><dd>−{formatPrice(discount)}</dd></div>}<div><dt>{pickup?'Collection':'Delivery fee'}</dt><dd>{shippingPending?'Choose an area':shipping?formatPrice(shipping):'Free'}</dd></div><div className="checkout-total"><dt>{shippingPending?'Food total':'Total'}</dt><dd>{formatPrice(shownTotal)}</dd></div></dl>
    {!pickup && freeDeliveryMinimum!=null && total<Number(freeDeliveryMinimum) && <p className="checkout-hint">Add {formatPrice(Number(freeDeliveryMinimum)-total)} in food for free delivery.</p>}
    {!pickup&&!shippingPending&&shipping===0&&freeDeliveryMinimum!=null&&total>=Number(freeDeliveryMinimum)&&<p className="checkout-hint">Free delivery applied: your food subtotal meets the kitchen’s {formatPrice(Number(freeDeliveryMinimum))} threshold.</p>}
    {shippingPending?<p className="checkout-hint">Choose your delivery area to confirm the fee and final total.</p>:<p className="checkout-hint">This is the total for this basket, including the shown discount and {pickup?'collection':'delivery'} fee.</p>}
    {!pickup && <p className="checkout-hint">The kitchen arranges delivery. The shown fee is included in your order total; a courier-price difference does not automatically add another charge.</p>}
   </div>
  </details>
 </aside>;
}
