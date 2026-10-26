import {shippingEnquiry} from '../../utils/sellingDetails';
import MenuVariants from '../../components/MenuVariants';
import {quantityLabel} from '../../utils/sellingDetails';
import MenuPhoto from '../../components/MenuPhoto';
import {deliveryDaysText} from '../../utils/deliveryDays';
import {menuDetail} from '../../utils/menuPresentation';
import {PageMeta} from '../../components/BusinessLayout';
import ProductOrderPanel from '../../components/ProductOrderPanel';
import {ChevronLeft,Clock3,CalendarDays,Users,MessageCircle,ChefHat,ArrowUpRight} from 'lucide-react';
import MenuReviews from "../../components/MenuReviews";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageLoading from "../../components/PageLoading";
import { readApiError } from "../../utils/apiError";
import axios from "axios";
import "./ProductDetailPage.css";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    axios.get(`/api/products/${id}/`, { signal: controller.signal })
      .then(res => { if (!controller.signal.aborted) { setProduct({ id, attempt, data: menuDetail(res.data,id) }); setFailure(null); } })
      .catch(err => { if (!controller.signal.aborted) setFailure({ id, attempt, message: err.response?.status === 404 ? 'This menu item is no longer available.' : readApiError(err, 'Unable to load this meal. Please try again.') }); });
    return () => controller.abort();
  }, [id, attempt]);

  if (failure?.id === id && failure.attempt === attempt) return <main className="meal-detail-page"><div className="meal-detail-unavailable"><h1>Meal unavailable</h1><p role="alert">{failure.message}</p><div className="detail-recovery"><button onClick={() => setAttempt(n => n + 1)}>Try again</button><Link to="/menu">Back to menu</Link></div></div></main>;
  if (product?.id !== id || product.attempt !== attempt) return <PageLoading label="Loading meal..." />;
  return <ProductContent key={id} product={product.data} id={id}/>;
}

function ProductContent({product,id}) {
 const [imageFailed,setImageFailed]=useState(false);
 return <main className="meal-detail-page">
  <PageMeta title={product.name} description={product.description || `View ${product.name}, preorder information and delivery days.`}/>
  <Link className="meal-back-link" to="/menu"><ChevronLeft size={17} aria-hidden="true"/>Back to menu</Link>
  <div className="meal-detail-grid"><div className="meal-detail-photo">
   {product.image_url && !imageFailed?<MenuPhoto sizes="(max-width: 700px) calc(100vw - 32px), 520px" src={product.image_url} alt={product.name} className="product-detail-image" decoding="async" onError={()=>setImageFailed(true)}/>:<div className="meal-photo-placeholder"><ChefHat size={48} aria-hidden="true"/><span>Photo coming soon</span></div>}
   {product.social_url && <a className="meal-social-link" href={product.social_url} target="_blank" rel="noreferrer">See how it’s made <ArrowUpRight size={15} aria-hidden="true"/></a>}
  </div><div className="meal-detail-copy">
   {product.category_name && <span className="meal-category">{product.category_name}</span>}
   <h1>{product.name}</h1>{product.description && <p className="meal-description">{product.description}</p>}
   <MenuVariants product={product}/><ProductOrderPanel product={product}/>
   {!shippingEnquiry(product.selling_details) && <dl className="meal-order-facts"><div><dt><Clock3 size={18} aria-hidden="true"/>Order ahead</dt><dd>{product.lead_hours>0?`${product.lead_hours} hours before preparation starts`:'Available times are checked in your basket'}</dd></div><div><dt><CalendarDays size={18} aria-hidden="true"/>Delivery days</dt><dd>{deliveryDaysText(product.delivery_weekdays).replace('Delivery: ','')}</dd></div><div><dt><Users size={18} aria-hidden="true"/>Daily menu limit</dt><dd>{quantityLabel(product.selling_details,product.daily_capacity)}, subject to other bookings</dd></div></dl>}
   {!shippingEnquiry(product.selling_details) && <p className="meal-schedule-note">Choose collection or delivery for your whole basket. Preparation and kitchen bookings are checked together.</p>}
   <div className="meal-kitchen-contact"><MessageCircle size={20} aria-hidden="true"/><div><strong>Allergies or dietary needs?</strong><p>Check with the kitchen before ordering.</p><Link to="/contact">Ask the kitchen</Link></div></div>
   <details className="meal-ingredient-note"><summary>About ingredient records</summary><p>Ingredient dates describe current stock; future meals may use new batches. Records do not establish an allergen-free kitchen.</p>{product.freshness && <p>Current ingredient record: {product.freshness}.</p>}</details>
  </div></div><MenuReviews id={id}/>
 </main>;
}
