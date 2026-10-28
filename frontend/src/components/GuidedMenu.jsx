import {useEffect,useId,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import axios from 'axios';
import {useAuth} from '../contexts/AuthContext';
import {useCart} from '../contexts/CartContext';
import {useProduct} from '../contexts/ProductContext';
import {useUI} from '../contexts/UIContext';
import {getCookie} from '../utils/cookieUtils';
import {readApiError} from '../utils/apiError';
import {recommendationEvent,selectRecommendation} from '../utils/recommendationEvents';
import {basketGuideResponse,basketGuideEmpty} from '../utils/basketGuide';
import {basketSearchDescription,basketRecoveryActions,basketPriceExplanation,basketRangeNotice} from '../utils/basketGuidePresentation';
import GuideBasketResults from './GuideBasketResults';
import {guideDateBounds} from '../utils/guidePresentation';

export default function GuidedMenu(){
 const [form,setForm]=useState({date:'',quantity:3,menu_mode:'mixed',budget:'',budget_mode:'within',category:''});
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[addingPlan,setAddingPlan]=useState(''),[expanded,setExpanded]=useState(false),[selected,setSelected]=useState(''),[success,setSuccess]=useState(null);
 const adding=!!addingPlan;
 const [requestScope,setRequestScope]=useState('');
 const {cart=[],cartLoading,cartError,cartUpdating,fulfilmentMethod,deliveryArea,chooseDeliveryDay,addSuggestedBasket}=useCart();
 const {isAuthenticated,accountKey}=useAuth(),{categories}=useProduct(),{formatPrice}=useUI();
 const generation=useRef(0),request=useRef(null),pending=useRef(false),errorRef=useRef(null),dateRef=useRef(null),helpId=useId();
 const scope=JSON.stringify([accountKey,isAuthenticated,cart.map(row=>[row.product.id,row.quantity,row.product.price]),fulfilmentMethod,deliveryArea]);
 const scopeRef=useRef(scope);
 const shown=data?.scope===scope?data:null;
 const bounds=guideDateBounds();
 const working=busy && requestScope===scope;
 const visibleError=requestScope===scope?error:'';
 useEffect(()=>{scopeRef.current=scope;request.current?.controller.abort();generation.current++;},[scope]);
 useEffect(()=>()=>request.current?.controller.abort(),[]);
 useEffect(()=>{if(expanded && shown?.plans.length)void recommendationEvent(shown.session,'impression');},[shown,expanded]);
 useEffect(()=>{if(visibleError && errorRef.current){errorRef.current.focus();errorRef.current.scrollIntoView({block:'nearest'});}},[visibleError]);
 const updateForm=next=>{request.current?.controller.abort();generation.current++;setForm(next.budget?next:{...next,budget_mode:'within'});setData(null);setError('');setBusy(false);setSuccess(null);};
 const search=async(event,values=form)=>{
  event?.preventDefault();if(working || pending.current || cartLoading || cartUpdating || cartError)return;
  request.current?.controller.abort();const controller=new AbortController();request.current={controller,scope};
  const version=++generation.current;setRequestScope(scope);setBusy(true);setError('');setData(null);setSuccess(null);setSelected('');
  const payload={date:values.date,quantity:Number(values.quantity),menu_mode:values.menu_mode,...(fulfilmentMethod?{delivery_method:fulfilmentMethod}:{}),...(deliveryArea?{delivery_area:deliveryArea}:{}),...(values.budget?{budget:values.budget,budget_mode:values.budget_mode}:{}),...(values.category?{category:Number(values.category)}:{})};
  try{
   const response=await axios.post('/api/menu/basket-guide/',payload,{signal:controller.signal,timeout:45000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(version===generation.current && !controller.signal.aborted && scopeRef.current===scope)setData({...basketGuideResponse(response.data,payload),scope});
  }catch(error){if(version===generation.current && !controller.signal.aborted && scopeRef.current===scope)setError(readApiError(error));}
  finally{if(version===generation.current && !controller.signal.aborted)setBusy(false);}
 };
 const add=async candidate=>{
  const picked=shown?.plans.find(option=>option.id===candidate?.id);
  if(pending.current || !shown || !picked)return;
  pending.current=true;setAddingPlan(picked.id);
  const session=shown.session;
  try{
   const result=await addSuggestedBasket({session,plan:picked.id,date_only:true},{session,plan:picked,quantity:shown.quantity,date_only:true,date:shown.date});
   if(result){
    for(const item of picked.items.filter(item=>item.add_quantity>0))void recommendationEvent(session,'added',item.id);
    const first=picked.items.find(item=>item.add_quantity>0);if(first)selectRecommendation(session,first.id);
    setSuccess({account:accountKey,message:result.basket_changed?'This option was already added; review your basket’s current total.':result.already_applied?'This option was already added. No duplicate items were added.':'Suggested items added. Choose or review your time in the basket.'});
   }
   if(result || isAuthenticated)setData(null);
  }finally{pending.current=false;setAddingPlan('');}
 };
 const categoryName=(Array.isArray(categories)?categories:[]).find(category=>String(category.id)===String(form.category))?.name || '';
 const description=shown?basketSearchDescription(shown,categoryName,formatPrice):null;
 const recovery=shown?basketRecoveryActions(shown,form.category):[];
 const priceExplanation=shown?basketPriceExplanation(shown,formatPrice):'';
 const rangeNotice=shown?basketRangeNotice(shown):'';
 const recover=action=>{
  if(action==='change_date'){dateRef.current?.focus();dateRef.current?.scrollIntoView({block:'center'});return;}
  const next={...form,...(action==='basket_quantity'?{quantity:shown.current_quantity}:action==='any_category'?{category:''}:action==='allow_mix'?{menu_mode:'mixed'}:{budget_mode:'all'})};
  setForm(next);void search(null,next);
 };
 return <details id="menu-finder" className="dk-panel guided-menu" onToggle={event=>setExpanded(event.currentTarget.open)}>
  <summary>Menu suggestions for your date</summary>
  <p>Find a mix of menus or several items of one menu. Choose the total item count and, optionally, a budget for the whole basket.</p>
  <form className="fyp-form inline" onSubmit={search} aria-describedby={helpId}>
   <fieldset className="guide-menu-choice" disabled={!!adding}><legend>Menu choice</legend><div>{[['mixed','Allow a mix'],['same','One menu only']].map(([value,label])=><label key={value} data-selected={form.menu_mode===value}><input type="radio" name={helpId+'-menu-choice'} value={value} checked={form.menu_mode===value} onChange={()=>updateForm({...form,menu_mode:value})}/><span>{label}</span></label>)}</div></fieldset>
   <label>Delivery date<input ref={dateRef} type="date" required min={bounds.first} max={bounds.last} disabled={!!adding} value={form.date} onChange={event=>updateForm({...form,date:event.target.value})}/></label>
   <label>Total items in this order<input type="number" required min="1" max="100" step="1" disabled={!!adding} value={form.quantity} onChange={event=>updateForm({...form,quantity:event.target.value})}/></label>
   <label>Whole-order budget (RM, optional)<input type="number" min="0.01" max="99999999.99" step="0.01" disabled={!!adding} value={form.budget} onChange={event=>updateForm({...form,budget:event.target.value})}/></label>
   <label>Budget preference<select disabled={adding || !form.budget} value={form.budget_mode} onChange={event=>updateForm({...form,budget_mode:event.target.value})}><option value="within">Within this budget</option><option value="above">Above this budget</option><option value="all">Within and above budget</option></select></label>
   <label>Preference for new items<select disabled={!!adding} value={form.category} onChange={event=>updateForm({...form,category:event.target.value})}><option value="">Any category</option>{(Array.isArray(categories)?categories:[]).map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
   <button disabled={working || adding || cartLoading || cartUpdating || !!cartError}>{working?'Checking complete baskets…':'Find my options'}</button>
  </form>
  <p id={helpId} className="guide-input-help">1–100 total items, including anything already in your basket. A meal, box or pack counts as one item. Totals include the current discount and delivery fee. Leave the budget blank for no price limit. Choose a date within 90 days.</p>
  {cartError && <p role="alert">Your basket could not be checked. <Link to="/cart">Review your basket</Link> before requesting suggestions.</p>}
  {working && <p role="status">Checking prices and one shared kitchen time for each complete basket…</p>}
  {visibleError && <p className="guide-error" role="alert" tabIndex={-1} ref={errorRef}>{visibleError}</p>}
  {success && success.account===accountKey && <p className="guide-success" role="status">{success.message} <Link to="/cart">View basket</Link></p>}
  {shown && <>
   <p className="guide-search-summary" role="status"><strong>{description.title}</strong><span>{description.details}</span>{description.existing && <span>{description.existing}</span>}</p>
   {!shown.basket_known && <p className="guide-input-help">This preview starts with an empty basket. Sign in to include your saved items before adding.</p>}
   {!shown.plans.length?<div className="guide-empty" role="status"><h3>No matching basket found</h3><p>{basketGuideEmpty(shown.empty_reason,shown.quantity,shown.current_quantity,shown.menu_mode)}</p>
    {priceExplanation && <p className="guide-price-explanation">{priceExplanation}</p>}
    <div className="guide-recovery-actions">{recovery.map(action=><button key={action} type="button" disabled={working || adding || cartLoading || cartUpdating || !!cartError} onClick={()=>recover(action)}>{action==='basket_quantity'?`Use ${shown.current_quantity} total items`:action==='compare_budget'?'Compare both budget ranges':action==='any_category'?'Try any category':action==='allow_mix'?'Allow a mix instead':'Choose another date'}</button>)}{shown.current_quantity>0 && <Link to="/cart">Review basket</Link>}</div>
   </div>:<GuideBasketResults data={shown} selectedId={selected} onSelect={setSelected} onAdd={add} onReview={()=>chooseDeliveryDay?.(shown.date)} onView={id=>selectRecommendation(shown.session,id)} authenticated={!!isAuthenticated} busyId={addingPlan} disabled={cartUpdating || cartLoading || !!cartError} formatPrice={formatPrice} rangeNotice={rangeNotice}/>}

   <details className="guide-method"><summary>How suggestions work</summary><p>{shown.message}</p></details>
  </>}
  <p className="guide-input-help">Allergies or dietary needs? Check with the kitchen before ordering.</p>
 </details>;
}
