import SellingDetails from './SellingDetails';
import {useId,useState} from 'react';
import {Link} from 'react-router-dom';
import {ChefHat} from 'lucide-react';
import MenuPhoto from './MenuPhoto';
import './MenuRecommendations.css';
export default function MenuRecommendationCard({menu,priceLabel,onView,children,compact=false,maxReasons}){
 const [failed,setFailed]=useState(false),heading=useId();
 const reasons=menu.reasons.slice(0,maxReasons ?? (compact?1:undefined));
 return <article className={`menu-recommendation-card${compact?' menu-recommendation-card--compact':''}`} aria-labelledby={heading}>
  <Link className="menu-recommendation-identity" to={`/products/${menu.id}`} onClick={onView}>
   <div className="menu-recommendation-photo">{menu.image_url && !failed?<MenuPhoto src={menu.image_url} alt="" sizes={compact?'(max-width: 600px) 80px, 88px':'(max-width: 600px) 240px, (max-width: 900px) 42vw, 360px'} loading="lazy" onError={()=>setFailed(true)}/>:<span><ChefHat size={32} aria-hidden="true"/>Photo coming soon</span>}</div>
   <div className="menu-recommendation-copy"><h3 id={heading}>{menu.name}</h3><SellingDetails details={menu.selling_details} compact/>{compact && <p className="menu-recommendation-price">{priceLabel}</p>}</div>
  </Link>
  <div className="menu-recommendation-body">{!compact && <p className="menu-recommendation-price">{priceLabel}</p>}{reasons.length>0 && <ul className="menu-recommendation-reasons" aria-label={`Why we suggest ${menu.name}`}>{reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}{children}</div>
 </article>;
}
