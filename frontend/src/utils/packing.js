import {confirmedHandover} from './handoverBoard.js';
import {emptySellingDetails} from './sellingDetails.js';
import {malaysiaDate} from './planner.js';

export function packingList(orders, date) {
  const active = orders.filter(o=>['pending','processing','cooked'].includes(o.status));
  const scheduled = active.filter(o=>confirmedHandover(o) && malaysiaDate(o.delivery_at)===date)
    .sort((a,b)=>Date.parse(a.delivery_at)-Date.parse(b.delivery_at) || a.id-b.id);
  const menus = new Map();
  for (const order of scheduled) for (const item of order.items) {
    // Keep renamed or deleted menus separate; totals are for packing, not shared cooking batches.
    const key = JSON.stringify([item.product ?? `deleted-${item.id}`, item.product_name,Object.entries({...emptySellingDetails(),...item.selling_details}).sort(([a],[b])=>a.localeCompare(b))]);
    const row = menus.get(key) || {key, name:item.product_name, selling_details:item.selling_details, quantity:0};
    row.quantity += Number(item.quantity);
    menus.set(key,row);
  }
  return {orders:scheduled, menus:[...menus.values()].sort((a,b)=>a.name.localeCompare(b.name)),
    portions:scheduled.reduce((n,o)=>n+o.items.reduce((sum,i)=>sum+Number(i.quantity),0),0),
    needsPreparationReview:active.filter(o=>Number.isFinite(Date.parse(o.delivery_at || '')) && malaysiaDate(o.delivery_at)===date && !o.preparation_plan?.needs_review && !confirmedHandover(o)).length,
    awaitingConfirmation:active.filter(o=>o.preparation_plan?.needs_review===true && Number.isFinite(Date.parse(o.delivery_at || '')) && malaysiaDate(o.delivery_at)===date).length,
    unscheduled:active.filter(o=>!o.delivery_at || !Number.isFinite(Date.parse(o.delivery_at))).length};
}
