import {Link} from 'react-router-dom';
import {ArrowRight,ShoppingBag} from 'lucide-react';
import {useCart} from '../contexts/CartContext';
import {useUI} from '../contexts/UIContext';
import './CustomerOrdering.css';

export default function BasketBar(){
 const {cart,total,cartLoading,cartError}=useCart();
 const {formatPrice}=useUI();
 if(!cart.length || cartError)return null;
 const count=cart.reduce((n,item)=>n+item.quantity,0);
 return <aside className="menu-basket-bar order-action-bar" aria-label="Basket summary" aria-busy={cartLoading}>
  <span className="basket-bar-icon" aria-hidden="true"><ShoppingBag size={23}/></span>
  <div className="basket-bar-copy"><strong>{count} {count===1?'item':'items'} in your basket</strong><span>Food subtotal · {formatPrice(total)}</span></div>
  <Link to="/cart">View basket <ArrowRight size={18} aria-hidden="true"/></Link>
 </aside>;
}
