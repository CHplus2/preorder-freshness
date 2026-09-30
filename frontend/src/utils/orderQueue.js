import {malaysiaDate} from './planner.js';
export const overdueOrder = (order, now) => !['delivered','cancelled'].includes(order.status) &&
  !!order.delivery_at && Date.parse(order.delivery_at) < now;

export function filterOrders(orders, filters, now) {
  const query=filters.search.trim().toLowerCase();
  return orders.filter(order=>{
    const searchable=[String(order.id),`ord-${String(order.id).padStart(5,'0')}`,order.user?.username,
      ...(order.items || []).map(i=>i.product_name)].filter(Boolean).join(' ').toLowerCase();
    return (!query || searchable.includes(query.replace(/^#/,''))) &&
      (!filters.status || order.status===filters.status) &&
      (!filters.payment || order.payment_status===filters.payment) &&
      (!filters.date || (order.delivery_at && malaysiaDate(order.delivery_at)===filters.date)) &&
      (!filters.overdue || overdueOrder(order,now));
  }).sort((a,b)=>filters.sort==='delivery' ?
    (Date.parse(a.delivery_at)||Infinity)-(Date.parse(b.delivery_at)||Infinity) || b.id-a.id : b.id-a.id);
}
