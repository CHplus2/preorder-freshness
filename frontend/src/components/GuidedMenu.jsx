import {quantityLabel,unitLabel} from '../utils/sellingDetails';
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
import MenuRecommendationCard from './MenuRecommendationCard';
import {guideDateBounds} from '../utils/guidePresentation';
import {moneyCents} from '../utils/guideBudget';

export default function GuidedMenu(){
 const [form,setForm]=useState({date:'',quantity:3,menu_mode:'mixed',budget:'',budget_mode:'within',category:''});
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[adding,setAdding]=useState(false),[expanded,setExpanded]=useState(false),[selected,setSelected]=useState(''),[success,setSuccess]=useState(null);
 const [requestScope,setRequestScope]=useState('');
 const {cart=[],cartLoading,cartError,cartUpdating,fulfilmentMethod,deliveryArea,chooseDeliveryDay,addSuggestedBasket}=useCart();
 const {isAuthenticated,accountKey}=useAuth(),{categories}=useProduct(),{formatPrice}=useUI();
 const generation=useRef(0),request=useRef(null),pending=useRef(false),errorRef=useRef(null),dateRef=useRef(null),helpId=useId();
 const scope=JSON.stringify([accountKey,isAuthenticated,cart.map(row=>[row.product.id,row.quantity,row.product.price]),fulfilmentMethod,deliveryArea]);
 const scopeRef=useRef(scope);
 const shown=data?.scope===scope?data:null;
 const plan=shown?.plans.find(option=>option.id===selected) || shown?.plans[0];
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
 const add=async()=>{
  if(pending.current || !shown || !plan)return;
  pending.current=true;setAdding(true);
  const picked=plan,session=shown.session;
  try{
   const result=await addSuggestedBasket({session,plan:picked.id,date_only:true},{session,plan:picked,quantity:shown.quantity,date_only:true,date:shown.date});
   if(result){
    for(const item of picked.items.filter(item=>item.add_quantity>0))void recommendationEvent(session,'added',item.id);
    const first=picked.items.find(item=>item.add_quantity>0);if(first)selectRecommendation(session,first.id);
    setSuccess({account:accountKey,message:result.basket_changed?'This option was already added; review your basket’s current total.':result.already_applied?'This option was already added. No duplicate items were added.':'Suggested items added. Choose or review your time in the basket.'});
   }
   if(result || isAuthenticated)setData(null);
  }finally{pending.current=false;setAdding(false);}
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
 const additions=plan?.items.reduce((sum,item)=>sum+item.add_quantity,0) || 0;
 const budget=shown?.budget?moneyCents(shown.budget.amount):null;
 const difference=plan && budget!==null?moneyCents(plan.totals.total)-budget:null;
 return <details id="menu-finder" className="dk-panel guided-menu" onToggle={event=>setExpanded(event.currentTarget.open)}>
  <summary>Menu suggestions for your date</summary>
  <p>Find a mix of menus or several items of one menu. Choose the total item count and a budget for the whole basket.</p>
  <form className="fyp-form inline" onSubmit={search} aria-describedby={helpId}>
   <fieldset className="guide-menu-choice" disabled={adding}><legend>Menu choice</legend><div>{[['mixed','Allow a mix'],['same','One menu only']].map(([value,label])=><label key={value} data-selected={form.menu_mode===value}><input type="radio" name={helpId+'-menu-choice'} value={value} checked={form.menu_mode===value} onChange={()=>updateForm({...form,menu_mode:value})}/><span>{label}</span></label>)}</div></fieldset>
   <label>Delivery date<input ref={dateRef} type="date" required min={bounds.first} max={bounds.last} disabled={adding} value={form.date} onChange={event=>updateForm({...form,date:event.target.value})}/></label>
   <label>Total items in this order<input type="number" required min="1" max="100" step="1" disabled={adding} value={form.quantity} onChange={event=>updateForm({...form,quantity:event.target.value})}/></label>
   <label>Whole-order budget (RM, optional)<input type="number" min="0.01" max="99999999.99" step="0.01" disabled={adding} value={form.budget} onChange={event=>updateForm({...form,budget:event.target.value})}/></label>
   <label>Budget preference<select disabled={adding || !form.budget} value={form.budget_mode} onChange={event=>updateForm({...form,budget_mode:event.target.value})}><option value="within">Within this budget</option><option value="above">Above this budget</option><option value="all">Within and above budget</option></select></label>
   <label>Preference for new items<select disabled={adding} value={form.category} onChange={event=>updateForm({...form,category:event.target.value})}><option value="">Any category</option>{(Array.isArray(categories)?categories:[]).map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
   <button disabled={working || adding || cartLoading || cartUpdating || !!cartError}>{working?'Checking complete baskets…':'Find my options'}</button>
  </form>
  <p id={helpId} className="guide-input-help">1–100 total items, including anything already in your basket. A meal, box or pack counts as one item. Totals include the current discount and delivery fee. Choose a date within 90 days.</p>
  {cartError && <p role="alert">Your basket could not be checked. <Link to="/cart">Review your basket</Link> before requesting suggestions.</p>}
  {working && <p role="status">Checking prices and one shared kitchen time for each complete basket…</p>}
  {visibleError && <p className="guide-error" role="alert" tabIndex={-1} ref={errorRef}>{visibleError}</p>}
  {success && success.account===accountKey && <p className="guide-success" role="status">{success.message} <Link to="/cart">View basket</Link></p>}
  {shown && <>
   <p className="guide-search-summary" role="status"><strong>{description.title}</strong><span>{description.details}</span>{description.existing && <span>{description.existing}</span>}</p>
   {!shown.basket_known && <p className="guide-input-help">This preview starts with an empty basket. Sign in to include your saved items before adding.</p>}
   {!plan?<div className="guide-empty" role="status"><h3>No matching basket found</h3><p>{basketGuideEmpty(shown.empty_reason,shown.quantity,shown.current_quantity,shown.menu_mode)}</p>
    {priceExplanation && <p className="guide-price-explanation">{priceExplanation}</p>}
    <div className="guide-recovery-actions">{recovery.map(action=><button key={action} type="button" disabled={working || adding || cartLoading || cartUpdating || !!cartError} onClick={()=>recover(action)}>{action==='basket_quantity'?`Use ${shown.current_quantity} total items`:action==='compare_budget'?'Compare both budget ranges':action==='any_category'?'Try any category':action==='allow_mix'?'Allow a mix instead':'Choose another date'}</button>)}{shown.current_quantity>0 && <Link to="/cart">Review basket</Link>}</div>
   </div>:<section className="guide-basket-plan" aria-labelledby={helpId+'-basket-title'}>
    <div className="guide-basket-heading"><h3 id={helpId+'-basket-title'}>{shown.quantity} {shown.quantity===1?'item':'items'}, one order</h3>{shown.plans.length>1 && <div className="guide-basket-options" role="group" aria-label="Alternative complete baskets">{shown.plans.map((option,index)=><button type="button" key={option.id} disabled={adding} aria-pressed={plan.id===option.id} onClick={()=>setSelected(option.id)}><span>Option {index+1}</span><strong>{formatPrice(option.totals.total)}</strong>{shown.budget?.mode==='all' && <small>{option.budget_relation==='above'?'Over budget':'Within budget'}</small>}</button>)}</div>}</div>
    {shown.plans.length>1 && <p className="guide-input-help">Choose one complete basket option. Every option has {shown.quantity} {shown.quantity===1?'item':'items'} in total.</p>}
    {rangeNotice && <p className="guide-range-notice" role="status">{rangeNotice}</p>}
    <div className="guide-results">{plan.items.map(item=><MenuRecommendationCard compact key={item.id} menu={item} priceLabel={`${formatPrice(item.price)} / ${unitLabel(item.selling_details)}`} onView={()=>selectRecommendation(shown.session,item.id)}>
     <p className="guide-plan-item-quantity"><strong>{quantityLabel(item.selling_details,item.quantity)}</strong>{item.quantity>1 && <span>{formatPrice(item.line_total)} subtotal</span>}</p>
     {item.existing_quantity>0 && <p className="guide-input-help">{item.existing_quantity} already in your basket{item.add_quantity>0?` · add ${item.add_quantity}`:' · kept'}</p>}
    </MenuRecommendationCard>)}</div>
    <div className="guide-order-footer"><dl className="guide-order-breakdown"><div><dt>Food subtotal</dt><dd>{formatPrice(plan.totals.subtotal)}</dd></div>{Number(plan.totals.discount)>0 && <div><dt>Current discount</dt><dd>−{formatPrice(plan.totals.discount)}</dd></div>}<div><dt>{shown.delivery_method==='pickup'?'Collection':'Delivery'}</dt><dd>{formatPrice(plan.totals.shipping)}</dd></div><div className="guide-order-total"><dt>Whole-order total · {shown.quantity} items</dt><dd>{formatPrice(plan.totals.total)}</dd></div></dl>
     {difference!==null && <p className="guide-order-budget" data-relation={difference>0?'above':'within'}>{difference===0?'Exactly on your whole-order budget':`${formatPrice(Math.abs(difference)/100)} ${difference>0?'over':'under'} your whole-order budget`}</p>}
     <p className="guide-date-availability">Times were found for this date. Choose a {shown.delivery_method==='pickup'?'collection':'delivery'} time in your basket.</p>
     {additions>0?<button className="guide-add-basket" type="button" disabled={adding || cartUpdating || cartLoading || !!cartError} onClick={add}>{adding?'Adding suggested items…':!isAuthenticated?'Sign in to add this basket':`Add ${additions} ${additions===1?'item':'items'} to basket`}</button>:<Link className="guide-review-basket" to="/cart" onClick={()=>{chooseDeliveryDay?.(shown.date);}}>Your {shown.quantity}-item basket is complete · review basket</Link>}
     <p className="guide-input-help">Availability covers all items together. Adding a basket does not reserve preparation; checkout checks again.</p>
    </div>
   </section>}
   <details className="guide-method"><summary>How suggestions work</summary><p>{shown.message}</p></details>
  </>}
  <p className="guide-input-help">Allergies or dietary needs? Check with the kitchen before ordering.</p>
 </details>;
}
