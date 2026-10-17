import {malaysiaDate,planningReadiness} from './planner.js';
export const overdueOrder = (order, now) => !['delivered','cancelled'].includes(order.status) &&
  !!order.delivery_at && Date.parse(order.delivery_at) < now;

export function archivedOnlyOrder(order,catalogue) {
  if(!catalogue || !order.items?.length)return false;
  const statuses=new Map(catalogue.map(menu=>[menu.id,menu.selling_status]));
  return order.items.every(item=>statuses.get(item.product)==='archived');
}
export function hiddenArchivedHistory(order,catalogue) {
  return ['delivered','cancelled'].includes(order.status) && archivedOnlyOrder(order,catalogue);
}

export function filterOrders(orders, filters, now, catalogue=null) {
  const query=filters.search.trim().toLowerCase();
  return orders.filter(order=>{
    const searchable=[String(order.id),`ord-${String(order.id).padStart(5,'0')}`,order.user?.username,
      ...(order.items || []).map(i=>i.product_name)].filter(Boolean).join(' ').toLowerCase();
    return (filters.includeArchived!==false || filters.review==='archived-menus' || !hiddenArchivedHistory(order,catalogue)) &&
      (filters.review!=='missing-delivery' || planningReadiness([order],now).missingDelivery.length>0) &&
      (filters.review!=='archived-menus' || archivedOnlyOrder(order,catalogue)) &&
      (!query || searchable.includes(query.replace(/^#/,''))) &&
      (!filters.status || order.status===filters.status) &&
      (!filters.payment || order.payment_status===filters.payment) &&
      (!filters.date || (order.delivery_at && malaysiaDate(order.delivery_at)===filters.date)) &&
      (!filters.overdue || overdueOrder(order,now));
  }).sort((a,b)=>filters.sort==='delivery' ?
    (Date.parse(a.delivery_at)||Infinity)-(Date.parse(b.delivery_at)||Infinity) || b.id-a.id : b.id-a.id);
}
