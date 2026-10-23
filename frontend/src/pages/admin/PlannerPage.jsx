import './OwnerWorkspace.css';
import OrderWorkflowActions from '../../components/OrderWorkflowActions';
import PlannerOrderCard from '../../components/PlannerOrderCard';
import TaskConflicts from '../../components/TaskConflicts';
import PlannerSnapshot from '../../components/PlannerSnapshot';
import PlannerReadiness from '../../components/PlannerReadiness';
import PackingList from '../../components/PackingList';
import ShoppingList from '../../components/ShoppingList';
import {useEffect,useMemo,useState} from 'react';
import axios from 'axios';
import {Link,useSearchParams} from 'react-router-dom';
import FreshCastWorkflowContext from '../../components/FreshCastWorkflowContext';
import KitchenAvailability from '../../components/KitchenAvailability';
import PlannerCalendar from '../../components/PlannerCalendar';
import {apiError} from '../../utils/apiError';
import {dailyWork,duration,malaysiaDate} from '../../utils/planner';
import {plannerCalendar} from '../../utils/plannerCalendar';
import {shoppingContextRows} from '../../features/predictive/decisionNavigation';
const time=d=>new Date(d).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'});
export default function PlannerPage(){
 const [params]=useSearchParams();
 const [showAllShopping,setShowAllShopping]=useState(false);
 const [showCalendar,setShowCalendar]=useState(false);
 const requestedOrder=/^[1-9]\d*$/.test(params.get('order') || '')?Number(params.get('order')):null;
 const shoppingFocus=params.get('from')==='freshcast' && /^[1-9]\d*$/.test(params.get('material') || '');
 const requestedDate=params.get('date');
 const [date,setDate]=useState(()=>/^\d{4}-\d{2}-\d{2}$/.test(requestedDate||'')&&Number.isFinite(Date.parse(requestedDate))&&new Date(requestedDate).toISOString().slice(0,10)===requestedDate?requestedDate:malaysiaDate(new Date())),
   [view,setView]=useState(()=>requestedOrder?'orders':['work','orders','awaiting','shopping','packing'].includes(params.get('view'))?params.get('view'):'work');
 const [plan,setPlan]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const [loadedAt,setLoadedAt]=useState(null);
 const [actionNotice,setActionNotice]=useState('');
 useEffect(()=>{const c=new AbortController();axios.get('/api/admin/planning/',{signal:c.signal}).then(r=>{if(!c.signal.aborted){setPlan(r.data);setLoadedAt(new Date().toISOString());}}).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))}).finally(()=>{if(!c.signal.aborted)setLoading(false)});return()=>c.abort();},[retry]);
 const waiting=(plan?.orders || []).filter(o=>o.status==='pending' && o.preparation_plan?.needs_review);
 const shownOrders=view==='awaiting'?waiting:(plan?.orders || []);
 const day=useMemo(()=>dailyWork(plan,date),[plan,date]);
 const dayOrderIds=new Set([...day.tasks.map(t=>t.orderId),...day.deliveries.map(o=>o.id),...day.requests.map(o=>o.id)]);
 const dayOrders=(plan?.orders || []).filter(o=>dayOrderIds.has(o.id));
 const openReview=id=>{setView('orders');setReviewTarget({id})};
 const [reviewTarget,setReviewTarget]=useState(()=>requestedOrder?{id:requestedOrder}:null);
 useEffect(()=>{if(view!=='orders' || !reviewTarget || loading || error)return;const target=document.getElementById(reviewTarget.id?'planner-order-'+reviewTarget.id:'planner-orders');target?.scrollIntoView({block:'center'});target?.focus({preventScroll:true});},[view,reviewTarget,loading,error,plan]);
 const refresh=notice=>{if(typeof notice==='string')setActionNotice(notice);setLoading(true);setError('');setRetry(n=>n+1)};
 const move=n=>setDate(malaysiaDate(new Date(Date.parse(date+'T12:00:00+08:00')+n*86400000)));
 const exportCalendar=()=>{
  if(loading || error || !plan)return;
  const calendar=plannerCalendar(plan.orders);
  if(!calendar.events){setActionNotice('No scheduled tasks or deliveries to export. Confirm delivery requests first.');return;}
  const url=URL.createObjectURL(new Blob([calendar.content],{type:'text/calendar'}));
  const a=document.createElement('a');a.href=url;a.download='kitchen-plan.ics';a.click();URL.revokeObjectURL(url);
  setActionNotice('Calendar downloaded. Unconfirmed delivery requests are excluded.'+(calendar.invalidTasks?` ${calendar.invalidTasks} invalid saved task timings were excluded; review those plans.`:''));
 };
 return <main className="dk-workspace planner-page"><FreshCastWorkflowContext/><div className="admin-page-heading"><div><span className="admin-kicker">KITCHEN OPERATIONS</span><h1>Planner</h1><p>Your daily preparation and deliveries, with requests kept separate until confirmed.</p></div><button disabled={loading} onClick={refresh}>{loading?'Refreshing...':'Refresh'}</button></div>
 {actionNotice && <p role="status" className="admin-notice">{actionNotice}</p>}
 <PlannerSnapshot loading={loading} error={error} hasPlan={!!plan} loadedAt={loadedAt} onRetry={refresh}>
 <PlannerReadiness menus={plan?.setup_menus || []} orders={plan?.orders || []} onReview={openReview} onSaved={refresh}/>
 <>{plan?.missing_recipes?.length>0 && <section className="admin-follow-up" aria-label="Recipe records need review"><strong>Recipe records need review</strong><p>The shopping list has {plan.missing_recipes.length} missing recipe {plan.missing_recipes.length===1?'record':'records'}. Review accepted recipes before buying ingredients.</p><button type="button" onClick={()=>openReview(plan.missing_recipes[0].order)}>Review affected orders</button></section>}</><div className="planner-datebar"><div className="admin-toolbar"><button aria-label="Previous day" onClick={()=>move(-1)}>Previous</button><label className="sr-only" htmlFor="planner-date">Work date</label><input id="planner-date" type="date" value={date} onChange={e=>e.target.value && setDate(e.target.value)}/><button aria-label="Next day" onClick={()=>move(1)}>Next</button><button onClick={()=>setDate(malaysiaDate(new Date()))}>Today</button></div><div className="planner-date-tools"><span>{new Date(date+'T12:00:00+08:00').toLocaleDateString('en-MY',{weekday:'long',day:'numeric',month:'short',timeZone:'Asia/Kuala_Lumpur'})} · Malaysia time</span><button type="button" aria-expanded={showCalendar} aria-controls="planner-month-picker" onClick={()=>setShowCalendar(open=>!open)}>{showCalendar?'Hide calendar':'Choose from calendar'}</button></div></div>
 {showCalendar && <div id="planner-month-picker"><PlannerCalendar date={date} onChange={setDate} orders={plan?.orders || []}/></div>}
 <div className="admin-metrics planner-day-metrics"><article><span>Hands-on work reserved</span><strong>{plan?duration(day.handsMinutes):'--'}</strong><small>of {duration(day.availableMinutes)} available after closures</small><progress max={Math.max(1,day.availableMinutes)} value={day.handsMinutes} aria-label="Reserved hands-on time"/></article><article><span>Preparation tasks</span><strong>{plan?day.tasks.length:'--'}</strong><small>{day.tasks.filter(t=>!t.worker).length} unattended / equipment still reserved</small></article><article><span>Deliveries</span><strong>{plan?day.deliveries.length:'--'}</strong><small>Scheduled for this date{day.requests.length>0 && ` · ${day.requests.length} unconfirmed ${day.requests.length===1?'request':'requests'} excluded`}</small></article></div>
 {(day.equipmentConflictMinutes>0 || day.closureConflictMinutes>0 || day.conflictingMinutes>0 || day.outsideHoursMinutes>0 || day.handsMinutes>day.availableMinutes) && <div className="admin-notice error" role="alert">This day needs review: existing work overlaps, falls outside kitchen hours, or exceeds available hours. Check the tasks before accepting more work.{day.equipmentConflictMinutes>0 && <p>Equipment conflicts: {duration(day.equipmentConflictMinutes)} with at least two tasks reserving the same equipment.</p>}{day.closureConflictMinutes>0 && <p>Closure conflicts: {duration(day.closureConflictMinutes)} with tasks scheduled during blocked kitchen time, including unattended work.</p>}</div>}
 <div className="planner-columns"><section><div className="admin-tabs" role="group" aria-label="Planner views">{[['work','Daily tasks'],['orders','Orders & review'],['awaiting',`Awaiting confirmation (${waiting.length})`],['shopping','Shopping'],['packing','Packing list']].map(([key,label])=><button aria-pressed={view===key} key={key} onClick={()=>setView(key)}>{label}</button>)}</div>
 {view==='shopping' && shoppingFocus && <section className="admin-notice" aria-label="Ingredient shopping context"><strong>{showAllShopping?'All shopping requirements':`Shopping review: ${params.get('ingredient') || 'selected ingredient'}`}</strong><p>These requirements come from recorded orders and can include requests outside FreshCast’s confirmed plan. The forecast gap has not been added as a purchase.</p><button onClick={()=>setShowAllShopping(value=>!value)}>{showAllShopping?'Focus selected ingredient':'Show all ingredients'}</button></section>}
 {loading && !plan?<div className="admin-empty" role="status">Loading your kitchen plan...</div>:view==='work'?<section aria-label="Daily tasks">{dayOrders.length>0 && <section className="planner-day-orders" aria-label="Daily order updates"><h2>Orders on this day</h2><p>Mark food ready after cooking and delivered after receipt. Preparation and dispatch updates are optional.</p>{dayOrders.map(order=><div className="planner-day-order" key={order.id}><button type="button" onClick={()=>openReview(order.id)}>Order #{order.id} · {order.items.map(i=>i.product_name).join(', ')}</button><OrderWorkflowActions order={order} onSaved={refresh}/></div>)}</section>}{day.tasks.length===0?<div className="admin-empty"><h2>No preparation scheduled for this day</h2><p>Choose another date, or review orders that do not have a task plan.</p><button onClick={()=>openReview(null)}>View orders</button></div>:<div className="task-agenda">{day.tasks.map(t=><article className={`agenda-row ${t.legacy?'needs-review':''}`} key={t.key}><div className="agenda-time"><strong>{malaysiaDate(t.start)<date?'Continues':time(t.start)}</strong><span>to {malaysiaDate(t.end)>date?'next day':time(t.end)}</span></div><div><div className="agenda-meta">Order #{t.orderId} / {t.portions?`${t.portions} selling units`: t.name==='Manual preparation window'?'Owner-arranged window':'Earlier booking'}</div><h2>{t.name}{t.batch_number?` · Batch ${t.batch_number}`:""}</h2><p>{t.menu}</p><div className="agenda-tags"><span>{t.resource==='all'?'Whole kitchen':t.resource.replaceAll('_',' ')}</span><span className={t.worker?'hands-on':'passive'}>{t.worker?'Hands-on':'Unattended'}</span><span>{duration(t.dayMinutes)} this day</span></div><TaskConflicts conflicts={t.conflicts} onReview={openReview}/>{t.legacy && <div className="agenda-actions"><button onClick={()=>openReview(t.orderId)}>Review task breakdown</button></div>}</div></article>)}</div>}</section>:(view==='orders' || view==='awaiting')?<section id="planner-orders" tabIndex={-1} aria-label="Orders requiring preparation">{shownOrders.length===0 && <div className="admin-empty">{view==='awaiting'?'No requests awaiting confirmation.':'No outstanding orders.'}</div>}{shownOrders.map(o=><PlannerOrderCard key={o.id} order={o} onSaved={refresh}/>)}</section>:view==='packing'?<PackingList orders={plan?.orders || []} date={date} loading={loading} error={error}/>:<ShoppingList loadedAt={loadedAt} rows={shoppingContextRows(plan?.shopping || [],params,showAllShopping)} through={date} missingRecipes={!!plan?.missing_recipes?.length}/>}
 </section><aside><KitchenAvailability onChanged={refresh}/><section className="admin-help"><h2>How capacity works</h2><p>One worker and one of each equipment type. Two hands-on tasks cannot overlap. Unattended tasks can overlap when they use different equipment.</p><p>Earlier work is allowed only within the menu's configured preparation span and waiting limits. Identical menus in separate orders are not automatically combined.</p><Link to="/admin/settings">Set kitchen hours</Link><p><Link to="/admin/ai/decisions?source=local">Open FreshCast</Link> for forecasts based on paid, delivered history. Task plans and sales history are tracked separately.</p></section><section className="admin-help"><h2>Calendar reminders</h2><p>Export scheduled tasks and deliveries. Unconfirmed requests are excluded. Re-export after changing a plan.</p><button disabled={loading || !!error || !plan} onClick={exportCalendar}>Export calendar</button></section></aside></div></PlannerSnapshot></main>;
}
