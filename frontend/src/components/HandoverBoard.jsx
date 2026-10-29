import DeliveryRunBlock from './DeliveryRunBlock';
import {arrivalLabel} from '../utils/arrivalWindow';
import '../pages/customer/CustomerExperience.css';
import HandoverDetails from './HandoverDetails';
import OrderContactActions from './OrderContactActions';
import CourierHandover from './CourierHandover';
import {Link} from 'react-router-dom';
import {useEffect,useState} from 'react';
import {handoverBoard,unitTotals} from '../utils/handoverBoard';
import {methodLabel,hourLabel} from '../utils/fulfilment';
import {quantityLabel} from '../utils/sellingDetails';
import {orderStatusLabel} from '../utils/orderPresentation';
import OrderWorkflowActions from './OrderWorkflowActions';
import OrderProgressBatch from './OrderProgressBatch';
import './HandoverBoard.css';

const time=value=>new Date(value).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'});
export default function HandoverBoard({orders,date,onReview,onSaved,now}){
 const [clock,setClock]=useState(()=>Date.now());
 useEffect(()=>{if(now!==undefined)return;const timer=setInterval(()=>setClock(Date.now()),60000);return()=>clearInterval(timer);},[now]);
 const board=handoverBoard(orders,date,now ?? clock);
 return <section className="handover-board" aria-label="Daily handovers">
  <header><div><h2>Collection & delivery runs</h2><p>Grouped by hour and method for {date} · Malaysia time. Each order keeps its own agreed time and preparation plan.</p></div><Link to={`/admin/planner?view=packing&date=${date}`}>Open packing list</Link></header>
  <div className="handover-metrics"><div><strong>{board.confirmed.length}</strong><span>Scheduled handovers</span></div><div><strong>{board.ready}</strong><span>Food ready</span></div><div><strong>{board.unpaid}</strong><span>Unpaid scheduled orders</span></div></div>
  <p className="handover-clarity">Grouping does not combine cooking batches or reserve a driver. If you deliver yourself, block driving time in Kitchen availability. Agree any express arrangement with the customer; the request does not reserve a faster service. Mark out for delivery when food is handed to the courier; opted-in dispatch emails are queued.</p>
  {board.confirmed.length>0 && <OrderProgressBatch key={date} orders={board.confirmed} onSaved={onSaved}/>}
  {board.requests.length>0 && <div className="handover-review"><strong>{board.requests.length} {board.requests.length===1?'order needs':'orders need'} preparation review for this date</strong><p>Excluded from run totals until reviewed. Existing reservations remain until replanned; new unconfirmed requests reserve no preparation time.</p><div>{board.requests.map(order=><button key={order.id} onClick={()=>onReview(order.id)}>Review #{order.id} · {arrivalLabel(order)}</button>)}</div></div>}
  {!board.groups.length && <p className="admin-empty">No confirmed handovers on this date. Choose another day or review requests above.</p>}
  {board.groups.map(group=><section className="handover-group" key={group.key} aria-label={`${hourLabel(group.hour)} ${methodLabel(group.method)}`}><div className="handover-group-heading"><h3>{hourLabel(group.hour)}–{hourLabel((group.hour+1)%24)} · {methodLabel(group.method)}</h3><span>{group.orders.length} {group.orders.length===1?'order':'orders'} · {unitTotals(group.orders)}</span></div>
   {group.orders.map(order=><article className="handover-order" key={order.id}><div className="handover-order-top"><h4>#{order.id} · {arrivalLabel(order)}</h4><span>{order.status==='cooked'?'Food ready':order.status==='shipped'?'Out for delivery':orderStatusLabel(order.status)}</span></div>
    <ul>{(order.items || []).slice(0,2).map((item,index)=><li key={item.id || index}>{quantityLabel(item.selling_details,item.quantity)} · {item.product_name}</li>)}</ul>
    {(order.items?.length || 0)>2 && <button className="handover-more" onClick={()=>onReview(order.id)}>View {order.items.length-2} more menu items</button>}
    <p className="handover-payment">Payment: <strong>{order.payment_status || 'Check payment records'}</strong>{order.fulfilment_snapshot?.delivery_area && <> · {order.fulfilment_snapshot.delivery_area}</>}</p>
    {order.dispatch_by && <p><strong>Dispatch target: {time(order.dispatch_by)}</strong> · planning allowance, not a live courier estimate.</p>}
    <HandoverDetails order={order}/><OrderContactActions order={order}/><CourierHandover key={'courier-'+order.id+'-'+order.updated_at} order={order} onSaved={onSaved}/>
    <OrderWorkflowActions order={order} onSaved={onSaved} compact/><DeliveryRunBlock order={order} onChanged={onSaved}/><div className="handover-order-links"><button onClick={()=>onReview(order.id)}>Review plan</button><Link to={`/admin/orders?order=${order.id}`}>Order & payment records</Link></div>
   </article>)}
  </section>)}
  <aside className="handover-follow-up"><h3>Follow up separately</h3><p>{board.overdue.length} open {board.overdue.length===1?'order is':'orders are'} past the requested handover time across all dates. {board.missingDates.length} have no valid date.</p><div><Link to="/admin/orders?queue=overdue">Review past-due orders</Link><Link to="/admin/orders?queue=unpaid">Review unpaid orders</Link><Link to="/admin/orders?queue=cancelled">Cancellations & payment review</Link></div><p>Mark food ready after cooking; this deducts accepted recipe ingredients once. Mark handover after receipt. Payment stays separate; cancellation does not refund money or restore ingredients. Use Review plan for optional preparation-start and dispatch tracking.</p></aside>
 </section>;
}
