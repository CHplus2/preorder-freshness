import {orderDate} from '../utils/orderPresentation';

export default function GeneratedHistoryCard({order,reference}) {
 const portions=order.items.reduce((n,item)=>n+Number(item.quantity),0);
 const amount=Number(order.total_amount);
 return <article className="order-card generated-history-card" aria-label={'Generated history '+reference}>
  <header><div><span className="generated-history-label">Demo data</span><h2>{orderDate(order.delivery_at,false)}</h2><p>History #{reference} · {order.items.length} menus · {portions} portions</p></div><div className="generated-history-total"><span>Scenario sales total</span><strong>{Number.isFinite(amount)?'RM '+amount.toFixed(2):'Not recorded'}</strong></div></header>
  <p className="generated-history-caption">Generated sales history for FreshCast. No customer payment or delivery occurred.</p>
  <details><summary>View menu quantities</summary><ul>{order.items.map((item,i)=><li key={item.id || i}><span>{item.product_name}</span><strong>×{item.quantity}</strong></li>)}</ul></details>
 </article>;
}
