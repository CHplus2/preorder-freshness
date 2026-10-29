import {arrivalStart} from './arrivalWindow.js';
import {malaysiaDate,savedPlanIssue} from './planner.js';
import {closedGeneratedHistory} from './orderPresentation.js';
import {unitLabel} from './sellingDetails.js';

const active=order=>['pending','processing','cooked','shipped'].includes(order.status) && !closedGeneratedHistory(order);
export function confirmedHandover(order,now=Date.now()){
 if(!active(order) || !Number.isFinite(Date.parse(order.delivery_at || '')) || order.preparation_plan?.needs_review)return false;
 if(['cooked','shipped'].includes(order.status))return true;
 if(savedPlanIssue(order,now))return false;
 const start=Date.parse(order.preparation_at || ''),end=Date.parse(order.preparation_end_at || '');
 return Number.isFinite(start) && Number.isFinite(end) && start<end && end<=Date.parse(order.delivery_at);
}
export function unitTotals(orders){
 const counts=new Map();
 for(const order of orders)for(const item of order.items || []){
  const unit=unitLabel(item.selling_details),value=Number(item.quantity);
  if(Number.isFinite(value) && value>0)counts.set(unit,(counts.get(unit) || 0)+value);
 }
 return [...counts].sort(([a],[b])=>a.localeCompare(b)).map(([unit,count])=>`${count} ${unitLabel({unit},count)}`).join(' · ') || 'Check item quantities';
}
export function handoverBoard(orders,date,now=Date.now()){
 const open=(orders || []).filter(active);
 const selected=open.filter(order=>Number.isFinite(Date.parse(order.delivery_at || '')) && malaysiaDate(order.delivery_at)===date);
 const confirmed=selected.filter(order=>confirmedHandover(order,now)).sort((a,b)=>Date.parse(arrivalStart(a))-Date.parse(arrivalStart(b)) || a.id-b.id);
 const groups=new Map();
 for(const order of confirmed){
  const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',hourCycle:'h23'}).format(new Date(arrivalStart(order)));
  const method=order.delivery_method==='pickup'?'pickup':'standard',key=hour+'-'+method;
  const group=groups.get(key) || {key,hour:Number(hour),method,orders:[]};group.orders.push(order);groups.set(key,group);
 }
 return {groups:[...groups.values()].sort((a,b)=>a.hour-b.hour || a.method.localeCompare(b.method)),confirmed,
  requests:selected.filter(order=>!confirmedHandover(order,now)),
  ready:confirmed.filter(order=>order.status==='cooked').length,
  unpaid:confirmed.filter(order=>order.payment_status==='unpaid').length,
  overdue:open.filter(order=>Number.isFinite(Date.parse(order.delivery_at || '')) && Date.parse(order.delivery_at)<now),
  missingDates:open.filter(order=>!Number.isFinite(Date.parse(order.delivery_at || '')))};
}
