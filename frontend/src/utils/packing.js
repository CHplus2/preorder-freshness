import {malaysiaDate} from './planner.js';

export function packingList(orders, date) {
  const active = orders.filter(o=>['pending','processing','cooked'].includes(o.status));
  const scheduled = active.filter(o=>o.delivery_at && Number.isFinite(Date.parse(o.delivery_at)) && malaysiaDate(o.delivery_at)===date)
    .sort((a,b)=>Date.parse(a.delivery_at)-Date.parse(b.delivery_at) || a.id-b.id);
  const menus = new Map();
  for (const order of scheduled) for (const item of order.items) {
    // Keep renamed or deleted menus separate; totals are for packing, not shared cooking batches.
    const key = JSON.stringify([item.product ?? `deleted-${item.id}`, item.product_name]);
    const row = menus.get(key) || {key, name:item.product_name, quantity:0};
    row.quantity += Number(item.quantity);
    menus.set(key,row);
  }
  return {orders:scheduled, menus:[...menus.values()].sort((a,b)=>a.name.localeCompare(b.name)),
    portions:scheduled.reduce((n,o)=>n+o.items.reduce((sum,i)=>sum+Number(i.quantity),0),0),
    unscheduled:active.filter(o=>!o.delivery_at || !Number.isFinite(Date.parse(o.delivery_at))).length};
}
