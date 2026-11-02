import ShippingOffer from './ShippingOffer';
import {shippingEnquiry} from '../utils/sellingDetails';
import SellingDetails from './SellingDetails';
import {unitLabel,shippingContact} from '../utils/sellingDetails';
import MenuPhoto from './MenuPhoto';
import MenuPreorderRules from './MenuPreorderRules';
import {shortDeliveryDays} from '../utils/menuPresentation';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Clock3,Plus,Minus,ChefHat,ArrowUpRight} from 'lucide-react';
import {useCart} from '../contexts/CartContext';
import {useAuth} from '../contexts/AuthContext';
import {useUI} from '../contexts/UIContext';

export default function MenuFoodCard({product:p}){
 const [busy,setBusy]=useState(false),[imageFailed,setImageFailed]=useState(false);
 const {cart,cartLoading,cartUpdating,cartError,addToCart,updateQuantity}=useCart();
 const {isAuthenticated}=useAuth();
 const {formatPrice}=useUI();
 const item=cart.find(row=>row.product.id===p.id);
 const disabled=busy || isAuthenticated===null || (isAuthenticated && (cartLoading || cartUpdating || cartError));
 const change=async action=>{if(disabled)return;setBusy(true);try{await action();}finally{setBusy(false);}};
 return <article className="menu-food-card" aria-labelledby={`menu-food-${p.id}`}>
  <Link to={`/products/${p.id}`} className="menu-food-link" aria-label={`View ${p.name}`}>
   <div className="menu-food-image">{p.image_url && !imageFailed?<MenuPhoto sizes="(max-width: 480px) 112px, (max-width: 700px) calc((100vw - 62px) / 2), (max-width: 1050px) 30vw, 300px" src={p.image_url} alt="" loading="lazy" decoding="async" onError={()=>setImageFailed(true)}/>:<div className="menu-photo-empty"><ChefHat size={38} aria-hidden="true"/><span>Photo coming soon</span></div>}<span className="menu-notice-badge"><Clock3 size={13} aria-hidden="true"/>{p.lead_hours>0?`${p.lead_hours}h notice`:'Preorder'}</span></div>
   <div className="menu-food-copy"><span className="menu-food-category">{p.category_name || 'From the kitchen'}</span><h3 id={`menu-food-${p.id}`}>{p.name}</h3>{p.delivery_weekdays?.length>0 && <span className="menu-food-days">Delivery {shortDeliveryDays(p.delivery_weekdays)}</span>}<SellingDetails details={p.selling_details} compact/>{shippingEnquiry(p.selling_details)?<ShippingOffer product={p} compact link={false}/>:<MenuPreorderRules product={p} compact/>}</div>
  </Link>
  <div className="menu-food-bottom"><div className="menu-food-price"><strong>{formatPrice(p.price)}</strong><span>Per {unitLabel(p.selling_details)} · {shippingEnquiry(p.selling_details)?'shipping agreed separately':`up to ${p.daily_capacity} / day`}</span></div>{shippingEnquiry(p.selling_details)?<Link className="menu-add" to={shippingContact(p.id)}>Ask kitchen</Link>:item?<div className="menu-quantity" role="group" aria-label={`Quantity of ${p.name}`}><button type="button" disabled={disabled} aria-label={`Decrease quantity of ${p.name}`} onClick={()=>change(()=>updateQuantity(item.id,item.quantity-1))}><Minus size={16}/></button><span aria-live="polite" aria-label={`${item.quantity} in basket`}><strong>{item.quantity}</strong><small>in basket</small></span><button type="button" disabled={disabled || item.quantity>=10000} aria-label={`Increase quantity of ${p.name}`} onClick={()=>change(()=>updateQuantity(item.id,item.quantity+1))}><Plus size={16}/></button></div>:<button type="button" className="menu-add" disabled={disabled} aria-label={`Add ${p.name} to basket`} onClick={()=>change(()=>addToCart(p.id))}>{busy?'Adding…':<>Add <Plus size={17} aria-hidden="true"/></>}</button>}</div>
  {p.social_url && <a className="menu-food-video" href={p.social_url} target="_blank" rel="noreferrer">See how it’s made <ArrowUpRight size={14} aria-hidden="true"/></a>}
 </article>;
}
