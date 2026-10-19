import {Link} from 'react-router-dom';
import ManualPlan from './ManualPlan';
import PlanReview from './PlanReview';
import PlanTimingNotice from './PlanTimingNotice';
import PreparationDays from './PreparationDays';
import OrderWorkflowActions from './OrderWorkflowActions';
import {duration} from '../utils/planner';
import {orderDate,orderStatusLabel} from '../utils/orderPresentation';
import './PlannerOrderCard.css';

export default function PlannerOrderCard({order,onSaved,now}) {
 const tasks=order.preparation_plan?.tasks || [];
 const minutes=task=>(Date.parse(task.end)-Date.parse(task.start))/60000;
 const valid=tasks.length>0 && tasks.every(t=>Number.isFinite(minutes(t)) && minutes(t)>0);
 const hands=valid?tasks.filter(t=>t.worker).reduce((n,t)=>n+minutes(t),0):0;
 const passive=valid?tasks.filter(t=>!t.worker).reduce((n,t)=>n+minutes(t),0):0;
 const elapsed=valid?(Math.max(...tasks.map(t=>Date.parse(t.end)))-Math.min(...tasks.map(t=>Date.parse(t.start))))/60000:0;
 return <article id={'planner-order-'+order.id} tabIndex={-1} className="admin-order-summary planner-order-card">
  <header className="planner-order-heading"><h2>Order #{order.id}</h2><span className={'status-badge status-'+order.status}>{orderStatusLabel(order.status)}</span></header>
  <ul className="planner-order-menus" aria-label="Ordered menus">{order.items.map((item,index)=><li key={item.id || index}><span>{item.product_name}</span><strong aria-label={item.quantity+' portions'}>×{item.quantity}</strong></li>)}</ul>
  <dl className="planner-order-dates"><div><dt>Delivery</dt><dd>{orderDate(order.delivery_at)}</dd></div><div><dt>Preparation starts</dt><dd>{orderDate(order.preparation_at)}</dd></div></dl>
  <PlanTimingNotice order={order} now={now}/>
  <OrderWorkflowActions order={order} onSaved={onSaved}/>
  {valid && <><dl className="planner-order-stats"><div><dt>Hands-on work</dt><dd>{duration(hands)}</dd></div><div><dt>Equipment & pauses</dt><dd>{duration(passive)}</dd></div><div><dt>Start to finish</dt><dd>{duration(elapsed)}</dd></div></dl><p className="planner-order-caption">The full window includes breaks; unattended steps can overlap.</p></>}
  <PreparationDays plan={order.preparation_plan}/>
  <div className="planner-order-actions"><Link className="text-link" to={'/admin/orders?order='+order.id}>Manage order #{order.id} →</Link>{order.delivery_method==='express' && <a href="https://www.grab.com/my/express/" target="_blank" rel="noreferrer">Arrange courier</a>}<span>Placed {order.created_at?orderDate(order.created_at):'date not recorded'}</span></div>
  {order.status==='pending' ? <div className="planner-order-controls"><ManualPlan key={order.id+order.updated_at} order={order} onSaved={onSaved}/><PlanReview order={order} onSaved={onSaved}/></div> : <p className="planner-order-caption">Preparation is {orderStatusLabel(order.status).toLowerCase()}. Only orders that have not started can be replanned.</p>}
 </article>;
}
