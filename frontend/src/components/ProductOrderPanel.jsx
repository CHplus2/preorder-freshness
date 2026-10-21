import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Minus,Plus,ShoppingBag} from 'lucide-react';
import {useCart} from '../contexts/CartContext';
import {useAuth} from '../contexts/AuthContext';
import {useUI} from '../contexts/UIContext';
import './CustomerOrdering.css';

export default function ProductOrderPanel({product}) {
 const {cart,cartLoading,cartUpdating,cartError,addToCart}=useCart();
 const {isAuthenticated}=useAuth();const {formatPrice}=useUI();
 const [quantity,setQuantity]=useState(1),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const pending=useRef(false);
 const existing=cart.find(row=>row.product.id===product.id)?.quantity || 0;
 const maximum=Math.max(0,10000-existing),chosen=Math.min(quantity,Math.max(1,maximum));
 const available=product.selling_status==='active';
 const disabled=!available || maximum===0 || busy || isAuthenticated===null || isAuthenticated && (cartLoading || cartUpdating || cartError);
 const add=async event=>{
  event.preventDefault();if(disabled || pending.current)return;
  pending.current=true;setBusy(true);setMessage('');
  try{if(await addToCart(product.id,chosen))setMessage(`${chosen} ${chosen===1?'item':'items'} added to your basket.`);}
  finally{pending.current=false;setBusy(false);}
 };
 return <section className="product-order-panel" aria-label="Add this meal to your basket">
  <div className="meal-price-line"><strong>{formatPrice(product.price)}</strong><span>each</span></div>
  {existing>0 && <p className="meal-in-basket"><ShoppingBag size={15} aria-hidden="true"/>{existing} already in your basket · <Link to="/cart">View basket</Link></p>}
  <form onSubmit={add}><div className="meal-purchase-dock order-action-bar">
   <div className="meal-quantity" role="group" aria-label="Quantity to add"><button type="button" aria-label="Decrease quantity to add" disabled={disabled || chosen<=1} onClick={()=>{setQuantity(n=>Math.max(1,n-1));setMessage('')}}><Minus size={18}/></button><output aria-label="Quantity to add" aria-live="polite">{chosen}</output><button type="button" aria-label="Increase quantity to add" disabled={disabled || chosen>=maximum} onClick={()=>{setQuantity(n=>Math.min(maximum,n+1));setMessage('')}}><Plus size={18}/></button></div>
   <button className="meal-add-button" disabled={disabled}>{!available?product.selling_status==='paused'?'Orders paused':'No longer offered':maximum===0?'Basket limit reached':busy?'Adding…':<>Add {chosen} · {formatPrice(Number(product.price)*chosen)}</>}</button>
  </div></form>
  <p className="meal-price-note">Food subtotal. Delivery and any group discount are shown in your basket.</p>
  {message && <p className="meal-added-message" role="status">{message} <Link to="/cart">View basket</Link></p>}
  {!available && <p className="meal-order-unavailable">This menu is not accepting new orders. <Link to="/menu">Explore the current menu</Link>.</p>}
 </section>;
}
