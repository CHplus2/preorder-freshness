import {Link} from 'react-router-dom';
import {planningReadiness,savedPlanIssue} from '../utils/planner';
import {unconfirmedDeliveryRequest} from '../utils/orderProgress';
import {orderMenuState} from '../utils/orderQueue';
import useOrderCatalogue from '../hooks/useOrderCatalogue';
import BatchDeliveryDates from './BatchDeliveryDates';

export default function PlannerSetup({menus,orders,onReview,onSaved,now}) {
 const groups=planningReadiness(orders,now);
 const requests=groups.needsPlan.filter(unconfirmedDeliveryRequest);
 const repairs=groups.needsPlan.filter(order=>!unconfirmedDeliveryRequest(order));
 const {catalogue,error,retry}=useOrderCatalogue();
 const classifications={current:0,mixed:0,archived:0,unlinked:0};
 for(const order of groups.missingDelivery)classifications[orderMenuState(order,catalogue)]++;
 const labels={current:'current menus',mixed:'current and archived menus',archived:'archived menus only',unlinked:'menu links need review'};
 const menuSetup=<div className={`planner-setup-row ${menus.length?'':'planner-setup-ready'}`}><div>
   <h2>{menus.length?`${menus.length} active ${menus.length===1?'menu needs':'menus need'} preparation steps`:'Cooking steps ready'}</h2>
   <p>{menus.length?'Add cooking steps and timings for these active menus.':'All active menus have preparation steps.'}</p>
  </div><Link className="text-link" to="/admin/products?review=preparation">{menus.length?'Add missing steps':'Review preparation steps'}</Link></div>;
 return <section className="planner-setup" aria-label="Planning readiness">
  {menus.length>0 && menuSetup}
  {requests.length>0 && <div className="planner-setup-row"><div>
   <h2>{requests.length} delivery {requests.length===1?'request needs':'requests need'} kitchen confirmation</h2>
   <p>These requested times are not confirmed. No preparation slots are reserved. Confirm a workable plan or arrange another delivery time.</p>
   <ul className="planner-record-preview">{requests.slice(0,3).map(order=><li key={order.id}>Request #{order.id} · {(order.items || []).map(item=>item.product_name).filter(Boolean).join(', ') || 'Review ordered menus'}</li>)}</ul>
  </div><button type="button" onClick={()=>onReview(requests[0].id)}>Review delivery requests</button></div>}
  {repairs.length>0 && <div className="planner-setup-row"><div>
   <h2>{repairs.length} upcoming {repairs.length===1?'order needs':'orders need'} preparation review</h2>
   <p>These pending orders have future delivery dates. Review and confirm their task plans before starting work.</p>
   {repairs.filter(order=>savedPlanIssue(order,now)).slice(0,3).map(order=><p key={order.id}>Order #{order.id}: {savedPlanIssue(order,now)}</p>)}
  </div><button type="button" onClick={()=>onReview(repairs[0].id)}>Plan upcoming orders</button></div>}
  {groups.missingDelivery.length>0 && <div className="planner-setup-row"><div>
   <h2>{groups.missingDelivery.length} {groups.missingDelivery.length===1?'delivery date needs':'delivery dates need'} review</h2>
   <p>Set an agreed future date for an open request, or close it if obsolete. These records are not completed sales.</p>
   {catalogue ? <div className="planner-readiness-tags" aria-label="Menus in orders missing dates">{Object.entries(classifications).filter(([,count])=>count>0).map(([kind,count])=><span key={kind}>{count} · {labels[kind]}</span>)}</div> : error ? <p role="alert">Menu status could not be checked. <button type="button" onClick={retry}>Retry menu check</button></p> : <p role="status">Checking menu references…</p>}
   <ul className="planner-record-preview">{groups.missingDelivery.slice(0,3).map(order=><li key={order.id}>Order #{order.id} · {(order.items || []).map(item=>item.product_name).filter(Boolean).join(', ') || 'No menu recorded'}</li>)}</ul>
   {groups.missingDelivery.length>3 && <p className="planner-record-more">Plus {groups.missingDelivery.length-3} more in delivery record review.</p>}
   {onSaved && <BatchDeliveryDates onSaved={onSaved}/>}
  </div><Link className="text-link" to="/admin/orders?review=missing-delivery">Review delivery records</Link></div>}
  {groups.overdue.length>0 && <div className="planner-setup-row"><div>
   <h2>{groups.overdue.length} past-due {groups.overdue.length===1?'order needs':'orders need'} follow-up</h2>
   <p>Check whether these orders were completed or need a new delivery arrangement. They are not upcoming preparation requests.</p>
  </div><Link className="text-link" to="/admin/orders?queue=overdue">Review past-due orders</Link></div>}
  {groups.started.length>0 && <div className="planner-setup-row"><div>
   <h2>{groups.started.length} started {groups.started.length===1?'order needs':'orders need'} record review</h2>
   <p>Preparation has started or stock was deducted. Review its existing records before changing the plan.</p>
  </div><Link className="text-link" to="/admin/orders">Review started orders</Link></div>}
  {menus.length===0 && menuSetup}

 </section>;
}
