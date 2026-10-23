export const orderStages = [
  ['pending','Order received'],['processing','Preparing'],['cooked','Ready for delivery'],
  ['shipped','Out for delivery'],['delivered','Delivered'],
];
export const unconfirmedDeliveryRequest = order => order.status==='pending'
 && order.preparation_plan?.needs_review===true && !order.inventory_deducted
 && Boolean(order.delivery_at) && !order.preparation_at && !order.preparation_end_at
 && !order.preparation_plan?.tasks?.length;

export function orderProgress(status,needsReview=false,pickup=false) {
  if(status==='pending' && needsReview)return {index:-1,label:pickup?'Collection request sent':'Delivery request sent',stages:[]};
  const stages=pickup?orderStages.filter(([key])=>key!=='shipped').map(([key,label])=>[key,key==='cooked'?'Ready for collection':key==='delivered'?'Collected':label]):orderStages;
  const index=stages.findIndex(([key])=>key===status);
  return {index,label:status==='cancelled'?'Cancelled':index<0?'Status unavailable':stages[index][1],
    stages:index<0?[]:stages.map(([key,label],i)=>({key,label,state:i<index?'complete':i===index?'current':'upcoming'}))};
}
