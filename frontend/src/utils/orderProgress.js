export const orderStages = [
  ['pending','Order received'],['processing','Preparing'],['cooked','Ready for delivery'],
  ['shipped','Out for delivery'],['delivered','Delivered'],
];
export function orderProgress(status) {
  const index=orderStages.findIndex(([key])=>key===status);
  return {index,label:status==='cancelled'?'Cancelled':index<0?'Status unavailable':orderStages[index][1],
    stages:index<0?[]:orderStages.map(([key,label],i)=>({key,label,state:i<index?'complete':i===index?'current':'upcoming'}))};
}
