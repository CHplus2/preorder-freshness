import {useEffect,useId,useRef,useState} from 'react';
import axios from 'axios';
import {ChevronLeft,ChevronRight,CalendarDays} from 'lucide-react';
import {useReducedMotion} from 'framer-motion';
import {useAuth} from '../contexts/AuthContext';
import {useCart} from '../contexts/CartContext';
import {useUI} from '../contexts/UIContext';
import {getCookie} from '../utils/cookieUtils';
import {readApiError} from '../utils/apiError';
import {menuSuggestions,openMenuFinder} from '../utils/menuSuggestions';
import {recommendationEvent,selectRecommendation} from '../utils/recommendationEvents';
import MenuRecommendationCard from './MenuRecommendationCard';
export default function MenuRecommendations(){
 const {isAuthenticated}=useAuth(),{cart,cartLoading,cartError,cartUpdating,addToCart}=useCart(),{formatPrice}=useUI();
 const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[adding,setAdding]=useState(null),[edges,setEdges]=useState({start:true,end:true});
 const row=useRef(null),pending=useRef(false),listId=useId(),reduced=useReducedMotion();
 useEffect(()=>{
  if(isAuthenticated===null)return;
  const controller=new AbortController();
  axios.post('/api/menu/suggestions/',{},{signal:controller.signal,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}})
   .then(({data})=>{const parsed=menuSuggestions(data);if(!controller.signal.aborted)setData(parsed);})
   .catch(error=>{if(!controller.signal.aborted)setError(readApiError(error,'Suggestions could not be loaded.'));});
  return()=>controller.abort();
 },[isAuthenticated,revision]);
 useEffect(()=>{if(data?.results.length)void recommendationEvent(data.session,'impression');},[data]);
 const measure=()=>{const node=row.current;if(node)setEdges({start:node.scrollLeft<2,end:node.scrollLeft+node.clientWidth>=node.scrollWidth-2});};
 useEffect(()=>{if(!row.current)return;const observer=new ResizeObserver(measure);observer.observe(row.current);return()=>observer.disconnect();},[data]);
 const add=async menu=>{
  if(pending.current)return;pending.current=true;setAdding(menu.id);selectRecommendation(data.session,menu.id);
  try{if(await addToCart(menu.id,1))void recommendationEvent(data.session,'added',menu.id);}finally{pending.current=false;setAdding(null);}
 };
 const scroll=direction=>row.current?.scrollBy({left:direction*row.current.clientWidth*.85,behavior:reduced?'instant':'smooth'});
 return <section className="menu-recommendations" aria-labelledby="menu-recommendations-title">
  <div className="menu-recommendations-heading"><div><span className="menu-recommendations-kicker">A LITTLE HELP CHOOSING</span><h2 id="menu-recommendations-title">Recommended for you</h2><p>{data?.basis==='history'?'Based on your previous orders and recent kitchen favourites.':data?.basis==='popularity'?'A few favourites based on recent paid orders.':'A few menus to help you get started.'}</p></div><button type="button" className="menu-recommendations-refine" onClick={openMenuFinder}><CalendarDays size={16} aria-hidden="true"/>Refine for my date</button></div>
  {error?<div className="menu-recommendations-status" role="alert"><p>{error}</p><button type="button" onClick={()=>{setError('');setData(null);setRevision(n=>n+1);}}>Retry suggestions</button></div>:!data?<p className="menu-recommendations-status" role="status">Finding a few suggestions…</p>:!data.results.length?<p className="menu-recommendations-status">No suggestions are available yet. You can browse all food below.</p>:<>
   <div className="menu-recommendations-controls"><span>{data.results.length} {data.results.length===1?'suggestion':'suggestions'}</span>{!(edges.start && edges.end) && <div><button type="button" aria-label="Previous recommendations" aria-controls={listId} disabled={edges.start} onClick={()=>scroll(-1)}><ChevronLeft size={19}/></button><button type="button" aria-label="Next recommendations" aria-controls={listId} disabled={edges.end} onClick={()=>scroll(1)}><ChevronRight size={19}/></button></div>}</div>
   <div ref={row} id={listId} className="menu-recommendations-row" onScroll={measure}>{data.results.map(menu=><MenuRecommendationCard compact maxReasons={1} key={menu.id} menu={menu} priceLabel={`${formatPrice(menu.price)} each`} onView={()=>selectRecommendation(data.session,menu.id)}><button type="button" className="menu-recommendation-add" aria-label={`Add one ${menu.name} to basket`} disabled={adding!==null || isAuthenticated===null || isAuthenticated && (cartLoading || cartError || cartUpdating) || (cart.find(item=>item.product.id===menu.id)?.quantity || 0)>=10000} onClick={()=>add(menu)}>{adding===menu.id?'Adding…':'Add 1 to basket'}</button></MenuRecommendationCard>)}</div>
   <p className="menu-recommendations-note">Food prices before delivery and discounts. Choose a date to check kitchen times, or continue with your basket.</p>
  </>}
 </section>;
}
