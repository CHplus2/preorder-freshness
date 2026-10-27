import {closedGeneratedHistory} from './orderPresentation.js';

export const progressChoices=[
 {status:'cooked',label:'Food ready',confirm:'Confirm food ready',note:'Confirm cooking and packing are finished. Accepted recipe ingredients are deducted once from usable stock.'},
 {status:'shipped',label:'Handed to courier',confirm:'Confirm handed to courier',note:'Confirm food has actually left with the rider or delivery person. Opted-in dispatch emails are queued; this does not book a courier.'},
 {status:'delivered',label:'Received / collected',confirm:'Confirm received or collected',note:'Confirm every selected customer or authorised recipient has received the food. This is not confirmation that a rider has collected it.'},
];

export function hasPreparationPlan(order){
 const start=Date.parse(order.preparation_at || ''),end=Date.parse(order.preparation_end_at || ''),delivery=Date.parse(order.delivery_at || '');
 return Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(delivery) && start<end && end<=delivery && !order.preparation_plan?.needs_review;
}

export function batchEligible(order,target){
 if(!Number.isSafeInteger(order.id) || !Number.isFinite(Date.parse(order.updated_at || '')) || closedGeneratedHistory(order))return false;
 if(target==='cooked')return ['pending','processing'].includes(order.status) && hasPreparationPlan(order);
 if(target==='shipped')return order.status==='cooked' && order.delivery_method!=='pickup';
 if(target==='delivered')return ['cooked','shipped'].includes(order.status);
 return false;
}

export function validateBatchResult(data,selected,target){
 const expected=new Set(selected.map(row=>row.id));
 if(!Array.isArray(data?.updated) || data.updated.length!==selected.length || !selected.length)throw new Error('Unexpected progress response');
 for(const row of data.updated){
  if(!expected.delete(row.id) || row.status!==target || !Number.isFinite(Date.parse(row.updated_at || '')))throw new Error('Unexpected progress response');
 }
 if(expected.size)throw new Error('Unexpected progress response');
 return data.updated;
}
