export const orderStages = [
  ['pending','Order received'],['processing','Preparing'],['cooked','Ready for delivery'],
  ['shipped','Out for delivery'],['delivered','Delivered'],
];
export const unconfirmedDeliveryRequest = order => order.status==='pending'
 && order.preparation_plan?.needs_review===true && !order.inventory_deducted
 && Boolean(order.delivery_at) && !order.preparation_at && !order.preparation_end_at
 && !order.preparation_plan?.tasks?.length;

export function orderProgress(status,needsReview=false) {
  if(status==='pending' && needsReview)return {index:-1,label:'Delivery request sent',stages:[]};
  const index=orderStages.findIndex(([key])=>key===status);
  return {index,label:status==='cancelled'?'Cancelled':index<0?'Status unavailable':orderStages[index][1],
    stages:index<0?[]:orderStages.map(([key,label],i)=>({key,label,state:i<index?'complete':i===index?'current':'upcoming'}))};
}
