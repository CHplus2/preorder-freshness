import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Clock3,Plus,Minus,ChefHat,ArrowUpRight} from 'lucide-react';
import {useCart} from '../contexts/CartContext';
import {useAuth} from '../contexts/AuthContext';
import {useUI} from '../contexts/UIContext';

export default function MenuFoodCard({product:p}){
 const [busy,setBusy]=useState(false),[imageFailed,setImageFailed]=useState(false);
 const {cart,cartLoading,addToCart,updateQuantity}=useCart();
 const {isAuthenticated}=useAuth();
 const {formatPrice}=useUI();
 const item=cart.find(row=>row.product.id===p.id);
 const disabled=busy || isAuthenticated===null || (isAuthenticated && cartLoading);
 const change=async action=>{if(disabled)return;setBusy(true);try{await action();}finally{setBusy(false);}};
 return <article className="menu-food-card" aria-labelledby={`menu-food-${p.id}`}>
  <Link to={`/products/${p.id}`} className="menu-food-link" aria-label={`View ${p.name}`}>
   <div className="menu-food-image">{p.image_url && !imageFailed?<img src={p.image_url} alt="" loading="lazy" decoding="async" onError={()=>setImageFailed(true)}/>:<div className="menu-photo-empty"><ChefHat size={38} aria-hidden="true"/><span>Photo coming soon</span></div>}<span className="menu-notice-badge"><Clock3 size={13} aria-hidden="true"/>{p.lead_hours}h notice</span></div>
   <div className="menu-food-copy"><span className="menu-food-category">{p.category_name || 'From the kitchen'}</span><h3 id={`menu-food-${p.id}`}>{p.name}</h3></div>
  </Link>
  <div className="menu-food-bottom"><div className="menu-food-price"><strong>{formatPrice(p.price)}</strong><span>Up to {p.daily_capacity} / day</span></div>{item?<div className="menu-quantity" role="group" aria-label={`Quantity of ${p.name}`}><button type="button" disabled={disabled} aria-label={`Decrease quantity of ${p.name}`} onClick={()=>change(()=>updateQuantity(item.id,item.quantity-1))}><Minus size={16}/></button><span aria-live="polite" aria-label={`${item.quantity} in basket`}>{item.quantity}</span><button type="button" disabled={disabled} aria-label={`Increase quantity of ${p.name}`} onClick={()=>change(()=>updateQuantity(item.id,item.quantity+1))}><Plus size={16}/></button></div>:<button type="button" className="menu-add" disabled={disabled} aria-label={`Add ${p.name} to basket`} onClick={()=>change(()=>addToCart(p.id))}>{busy?'Adding…':<>Add <Plus size={17} aria-hidden="true"/></>}</button>}</div>
  {p.social_url && <a className="menu-food-video" href={p.social_url} target="_blank" rel="noreferrer">See how it’s made <ArrowUpRight size={14} aria-hidden="true"/></a>}
 </article>;
}
