import {Link} from 'react-router-dom';
import {orderProgress} from '../utils/orderProgress';
import {isPickup} from '../utils/fulfilment';
import './OrderProgress.css';
export default function OrderProgress({order}) {
  const progress=orderProgress(order.status,order.preparation_plan?.needs_review,isPickup(order));
  const menus=[...new Map(order.items.filter(i=>i.product).map(i=>[i.product,i])).values()];
  if(order.status==='pending' && order.preparation_plan?.needs_review)return <section className="order-progress" aria-label="Order progress"><h3 className="order-progress-heading">Awaiting kitchen confirmation</h3><p>This delivery time is requested, not confirmed. No preparation slot is reserved yet. The kitchen will confirm a workable plan or contact you to arrange another time.</p>{order.payment_status==='unpaid' && <p>No payment was taken when you submitted this request.</p>}</section>;
  return <section className={'order-progress'+(isPickup(order)?' order-progress--pickup':'')} aria-label="Order progress">
    <div className="order-progress-heading"><h3>Order progress</h3><span>{order.status==='pending' && order.preparation_plan?.manually_confirmed_at?'Kitchen confirmed':isPickup(order)?'Preparation and collection':'Preparation and delivery'}</span></div>
    {progress.stages.length>0?<ol>{progress.stages.map((stage,i)=><li key={stage.key} className={`progress-${stage.state}`} aria-current={stage.state==='current'?'step':undefined}><span aria-hidden="true" className="progress-dot">{stage.state==='complete'?'✓':i+1}</span><span>{stage.label}{stage.state==='current' && <small>Current stage</small>}</span></li>)}</ol>:<p>{order.status==='cancelled'?'This order was cancelled. Any payment or refund is tracked separately.':'Refresh your orders or contact the kitchen for an update.'}</p>}
    {order.status==='delivered' && menus.length>0 && <div className="order-review-actions"><p>How was your meal? Open a dish to leave or view your review.</p>{menus.map(i=><Link key={i.product} to={`/products/${i.product}`}>Review {i.product_name}</Link>)}</div>}
  </section>;
}
