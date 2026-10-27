import {quantityLabel,unitLabel} from '../utils/sellingDetails';
import {useEffect,useId,useRef,useState} from 'react';
import axios from 'axios';
import {useCart} from '../contexts/CartContext';
import {useProduct} from '../contexts/ProductContext';
import {useUI} from '../contexts/UIContext';
import {getCookie} from '../utils/cookieUtils';
import {readApiError} from '../utils/apiError';
import {guideResponse,rememberSuggestion} from '../utils/guideResponse';
import {recommendationEvent,selectRecommendation} from '../utils/recommendationEvents';
import MenuRecommendationCard from './MenuRecommendationCard';
import {guideDateBounds,guideEmptyMessage} from '../utils/guidePresentation';
import {budgetBadge,budgetComparison,budgetSummary,budgetCatalogueMessage} from '../utils/guideBudget';
export default function GuidedMenu(){
 const [form,setForm]=useState({date:'',portions:1,budget:'',budget_mode:'within',category:''});
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[adding,setAdding]=useState(null),[expanded,setExpanded]=useState(false),[submitted,setSubmitted]=useState(null);
 const {addToCart,cartLoading,cartError,cartUpdating,cart,fulfilmentMethod,chooseArrivalWindow}=useCart(),{categories}=useProduct(),{formatPrice}=useUI();
 const generation=useRef(0),request=useRef(null),pending=useRef(false),errorRef=useRef(null),helpId=useId();
 const bounds=guideDateBounds();
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{if(expanded && data?.results.length)void recommendationEvent(data.session,'impression');},[data,expanded]);
 useEffect(()=>{if(error && errorRef.current){errorRef.current.focus();errorRef.current.scrollIntoView({block:'nearest'});}},[error]);
 const search=async(event,values=form)=>{
  event?.preventDefault();if(busy || pending.current)return;
  request.current?.abort();const controller=new AbortController();request.current=controller;
  const version=++generation.current;setBusy(true);setError('');setData(null);
  setSubmitted({...values,categoryLabel:(Array.isArray(categories)?categories:[]).find(category=>String(category.id)===String(values.category))?.name || 'Any category'});
  try{
   const response=await axios.post('/api/menu/guide/',{date:values.date,portions:Number(values.portions),...(fulfilmentMethod?{delivery_method:fulfilmentMethod}:{}),...(values.budget?{budget:values.budget,budget_mode:values.budget_mode}:{}),...(values.category?{category:Number(values.category)}:{})},{signal:controller.signal,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(version===generation.current && !controller.signal.aborted)setData(guideResponse(response.data,values));
  }catch(error){if(version===generation.current && !controller.signal.aborted)setError(readApiError(error));}
  finally{if(version===generation.current && !controller.signal.aborted)setBusy(false);}
 };
 const updateForm=next=>{request.current?.abort();generation.current++;setForm(next.budget?next:{...next,budget_mode:'within'});setData(null);setSubmitted(null);setError('');setBusy(false);};
 const searchAll=()=>{const next={...form,category:''};setForm(next);void search(null,next);};
 const compareBoth=()=>{const next={...form,budget_mode:'all'};setForm(next);void search(null,next);};
 const add=async(menu,slot)=>{
  if(pending.current)return;pending.current=true;setAdding(menu.id);
  chooseArrivalWindow?.(0);rememberSuggestion('preferredDelivery',slot.delivery_at);selectRecommendation(data.session,menu.id);
  try{if(await addToCart(menu.id,menu.portions))void recommendationEvent(data.session,'added',menu.id);}
  finally{pending.current=false;setAdding(null);}
 };
 return <details id="menu-finder" className="dk-panel guided-menu" onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Menu suggestions for your date</summary><p>Get up to three menu suggestions for your delivery date, quantity and budget. Each suggestion is an alternative purchase of one menu, not part of a combined set. These preferences apply to this search; the full menu and Recommended for you stay unchanged.</p>
  <p id={helpId} className="guide-input-help">Choose a date within the next 90 days and 1–100 selling units. A unit may be a meal, box or pack; it is not a diner count. The optional budget covers this quantity of one menu before discounts. Delivery and existing basket items are extra.</p>
  <form className="fyp-form inline" onSubmit={search} aria-describedby={helpId}>
   <label>Delivery date<input type="date" required min={bounds.first} max={bounds.last} disabled={adding!==null} value={form.date} onChange={event=>updateForm({...form,date:event.target.value})}/></label>
   <label>Quantity per menu<input type="number" required min="1" max="100" step="1" disabled={adding!==null} value={form.portions} onChange={event=>updateForm({...form,portions:event.target.value})}/></label>
   <label>Total food budget (RM, optional)<input type="number" min="0.01" max="99999999.99" step="0.01" disabled={adding!==null} value={form.budget} onChange={event=>updateForm({...form,budget:event.target.value})}/></label>
   <label><span id={helpId+'-budget-mode'}>Compare food total</span><select aria-labelledby={helpId+'-budget-mode'} disabled={adding!==null || !form.budget} value={form.budget_mode} onChange={event=>updateForm({...form,budget_mode:event.target.value})}><option value="within">Within this budget</option><option value="above">Above this budget</option><option value="all">Within and above budget</option></select></label>
   <label>Preference<select value={form.category} disabled={adding!==null} onChange={event=>updateForm({...form,category:event.target.value})}><option value="">Any category</option>{(Array.isArray(categories)?categories:[]).map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
   <button disabled={busy || adding!==null}>{busy?'Checking kitchen times…':'Find my options'}</button>
  </form>{busy && <p role="status">Checking menus and kitchen times for your date…</p>}{error && <p className="guide-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
  {data && <>
   {submitted && <p className="guide-request-summary">Search: <strong>{submitted.categoryLabel}</strong> · {new Date(submitted.date+'T12:00:00+08:00').toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric'})} · {submitted.portions} {Number(submitted.portions)===1?'unit':'units'}{submitted.budget && <> · {budgetSummary(submitted.budget_mode,submitted.budget,formatPrice)}</>}</p>}
   {data.budget_catalogue && submitted?.budget && <p className="guide-catalogue-price" role="status">{budgetCatalogueMessage(data.budget_catalogue,submitted.budget,formatPrice)}</p>}
   {data.results.length===0?<div className="guide-empty" role="status"><h3>No matching options found</h3>
    <p>{data.empty_reason==='shipping_enquiry'?'These offers need a shipping enquiry. Their dispatch windows are not local delivery slots; browse the menu and agree courier, fees and arrival estimates with the kitchen.':guideEmptyMessage(data.empty_reason,submitted?.categoryLabel,submitted?.budget_mode)}</p>
    <div className="guide-recovery-actions">{submitted?.category && <button type="button" disabled={busy} onClick={searchAll}>Search all categories</button>}{submitted?.budget && submitted.budget_mode!=='all' && <button type="button" disabled={busy} onClick={compareBoth}>Compare within and above budget</button>}</div>
   </div>:<>
    <p role="status">{data.results.length} alternative {data.results.length===1?'menu':'menus'} · each total is for {submitted?.portions} units of that menu. Choose a menu and time below. Combining options changes the basket total; checkout rechecks the whole basket.</p>
    <div className="guide-results">{data.results.map(menu=><MenuRecommendationCard compact key={menu.id} menu={menu} priceLabel={`${formatPrice(menu.food_total)} for ${quantityLabel(menu.selling_details,menu.portions)}`} onView={()=>selectRecommendation(data.session,menu.id)}>
     <p className="guide-price-breakdown">{formatPrice(menu.price)} per {unitLabel(menu.selling_details)} × {menu.portions} = <strong>{formatPrice(menu.food_total)} food total</strong></p>
     {submitted?.budget && <p className="guide-budget-comparison" data-relation={budgetComparison(menu,submitted.budget)?.relation}>{budgetBadge(menu,submitted.budget,formatPrice)}</p>}
     <div className="menu-recommendation-times"><p>Choose a delivery time (Malaysia):</p><div>{menu.slots.map(slot=><button type="button" key={slot.delivery_at} disabled={adding!==null || cartLoading || cartError || cartUpdating || (cart.find(item=>item.product.id===menu.id)?.quantity || 0)+menu.portions>10000} onClick={()=>add(menu,slot)}>{adding===menu.id?'Adding…':`${new Date(slot.delivery_at).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'})} · Add ${menu.portions}`}</button>)}</div></div>
    </MenuRecommendationCard>)}</div>
   </>}
   <details className="guide-method"><summary>How suggestions work</summary><p>{data.message}</p></details>
  </>}
  <p>Allergies or dietary needs? Check with the kitchen before ordering.</p>
 </details>;
}
