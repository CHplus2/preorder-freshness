import {Link} from 'react-router-dom';
import {orderProgress} from '../utils/orderProgress';
import './OrderProgress.css';
export default function OrderProgress({order}) {
  const progress=orderProgress(order.status);
  const menus=[...new Map(order.items.filter(i=>i.product).map(i=>[i.product,i])).values()];
  return <section className="order-progress" aria-label="Order progress">
    <p className="order-progress-heading"><strong>{progress.label}</strong><span>Updated by the kitchen</span></p>
    {progress.stages.length>0?<ol>{progress.stages.map((stage,i)=><li key={stage.key} className={`progress-${stage.state}`} aria-current={stage.state==='current'?'step':undefined}><span aria-hidden="true" className="progress-dot">{stage.state==='complete'?'✓':i+1}</span><span>{stage.label}{stage.state==='current' && <small>Current stage</small>}</span></li>)}</ol>:<p>{order.status==='cancelled'?'This order was cancelled. Any payment or refund is tracked separately.':'Refresh your orders or contact the kitchen for an update.'}</p>}
    {order.status==='delivered' && menus.length>0 && <div className="order-review-actions"><p>How was your meal? Open a dish to leave or view your review.</p>{menus.map(i=><Link key={i.product} to={`/products/${i.product}`}>Review {i.product_name}</Link>)}</div>}
  </section>;
}
