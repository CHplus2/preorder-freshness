import {malaysiaDate,planningReadiness} from './planner.js';
import {closedGeneratedHistory} from './orderPresentation.js';
export const overdueOrder = (order, now) => !['delivered','cancelled'].includes(order.status) &&
  !!order.delivery_at && Date.parse(order.delivery_at) < now;

export const orderQueues=[['open','Open orders'],['requests','Needs confirmation'],['ready','Ready / on the way'],['overdue','Past due'],['all','All orders']];
export function inOrderQueue(order,queue,now) {
  if(queue==='open')return ['pending','processing','cooked','shipped'].includes(order.status);
  if(queue==='requests')return order.status==='pending' && order.preparation_plan?.needs_review===true;
  if(queue==='ready')return ['cooked','shipped'].includes(order.status);
  if(queue==='overdue')return overdueOrder(order,now);
  return true;
}
export function orderQueueCounts(orders,now) {
  const ordinary=orders.filter(order=>!closedGeneratedHistory(order));
  return Object.fromEntries(orderQueues.map(([key])=>[key,ordinary.filter(order=>inOrderQueue(order,key,now)).length]));
}

export function orderMenuState(order,catalogue) {
  if(!catalogue || !order.items?.length)return 'unlinked';
  const statuses=new Map(catalogue.map(menu=>[menu.id,menu.selling_status]));
  const states=order.items.map(item=>statuses.get(item.product));
  if(states.some(state=>!state))return 'unlinked';
  if(states.every(state=>state==='archived'))return 'archived';
  return states.some(state=>state==='archived')?'mixed':'current';
}
export function archivedOnlyOrder(order,catalogue) {
  return orderMenuState(order,catalogue)==='archived';
}
export function hiddenArchivedHistory(order,catalogue) {
  return ['delivered','cancelled'].includes(order.status) && archivedOnlyOrder(order,catalogue);
}

export function filterOrders(orders, filters, now, catalogue=null) {
  const query=filters.search.trim().toLowerCase();
  return orders.filter(order=>{
    const searchable=[String(order.id),`ord-${String(order.id).padStart(5,'0')}`,order.user?.username,
      ...(order.items || []).map(i=>i.product_name)].filter(Boolean).join(' ').toLowerCase();
    const scope=filters.historyScope || 'orders';
    return (scope==='all' || (scope==='generated' ? closedGeneratedHistory(order) : !closedGeneratedHistory(order))) &&
      (filters.includeArchived!==false || filters.review==='archived-menus' || !hiddenArchivedHistory(order,catalogue)) &&
      (filters.review!=='missing-delivery' || planningReadiness([order],now).missingDelivery.length>0) &&
      (filters.review!=='archived-menus' || archivedOnlyOrder(order,catalogue)) &&
      (!query || searchable.includes(query.replace(/^#/,''))) &&
      (!filters.status || order.status===filters.status) &&
      (!filters.payment || order.payment_status===filters.payment) &&
      inOrderQueue(order,filters.queue,now) &&
      (!filters.date || (order.delivery_at && malaysiaDate(order.delivery_at)===filters.date)) &&
      (!filters.overdue || overdueOrder(order,now));
  }).sort((a,b)=>filters.sort==='delivery' ?
    (Date.parse(a.delivery_at)||Infinity)-(Date.parse(b.delivery_at)||Infinity) || b.id-a.id : b.id-a.id);
}
