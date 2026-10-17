import {Link} from 'react-router-dom';
import {planningReadiness} from '../utils/planner';
import {archivedOnlyOrder} from '../utils/orderQueue';
import useOrderCatalogue from '../hooks/useOrderCatalogue';

export default function PlannerSetup({menus,orders,onReview,now}) {
 const groups=planningReadiness(orders,now);
 const {catalogue,error,retry}=useOrderCatalogue();
 const archivedMissing=groups.missingDelivery.filter(order=>archivedOnlyOrder(order,catalogue)).length;
 return <section className="planner-setup" aria-label="Planning readiness">
  <div className="planner-setup-row"><div>
   <h2>{menus.length?`${menus.length} active ${menus.length===1?'menu needs':'menus need'} preparation steps`:'Active menu preparation is set up'}</h2>
   <p>{menus.length?'Add cooking steps and timings for these active menus.':'All active menus have cooking steps. Order scheduling is checked separately below.'}</p>
  </div><Link className="text-link" to="/admin/products?review=preparation">{menus.length?'Add missing steps':'Review preparation steps'}</Link></div>
  {groups.needsPlan.length>0 && <div className="planner-setup-row"><div>
   <h2>{groups.needsPlan.length} upcoming {groups.needsPlan.length===1?'order needs':'orders need'} preparation review</h2>
   <p>These pending orders have future delivery dates. Review and confirm their task plans before starting work.</p>
  </div><button type="button" onClick={()=>onReview(groups.needsPlan[0].id)}>Plan upcoming orders</button></div>}
  {groups.missingDelivery.length>0 && <div className="planner-setup-row"><div>
   <h2>{groups.missingDelivery.length} {groups.missingDelivery.length===1?'order has':'orders have'} no valid delivery date</h2>
   <p>These are open orders, not completed sales. Confirm a real delivery arrangement, or cancel an obsolete test request. Do not invent dates for historical records.</p>
   {catalogue ? <p>{archivedMissing} contain only archived menus; {groups.missingDelivery.length-archivedMissing} contain current or unverified menu references. Archiving a menu does not close its orders.</p> : error ? <p role="alert">Menu archive status could not be checked. <button type="button" onClick={retry}>Retry menu check</button></p> : <p role="status">Checking which orders belong to archived menus…</p>}
  </div><Link className="text-link" to="/admin/orders?review=missing-delivery">Review delivery records</Link></div>}
  {groups.overdue.length>0 && <div className="planner-setup-row"><div>
   <h2>{groups.overdue.length} past-due {groups.overdue.length===1?'order needs':'orders need'} follow-up</h2>
   <p>Check whether these orders were completed or need a new delivery arrangement. They are not upcoming preparation requests.</p>
  </div><Link className="text-link" to="/admin/orders">Review past-due orders</Link></div>}
  {groups.started.length>0 && <div className="planner-setup-row"><div>
   <h2>{groups.started.length} started {groups.started.length===1?'order needs':'orders need'} record review</h2>
   <p>Preparation has started or stock was deducted. Review its existing records before changing the plan.</p>
  </div><Link className="text-link" to="/admin/orders">Review started orders</Link></div>}
  <div className="planner-setup-row"><div><h2>Sales forecasts use delivery history</h2>
   <p>Paid, delivered orders inform menu forecasts, then recipes translate portions into ingredient needs. Task plans are separate. Generated history remains labelled as demo evidence.</p>
  </div><Link className="text-link" to="/admin/ai/decisions?source=local">Open kitchen decision assistant</Link></div>
 </section>;
}
