export const malaysiaDate = value => new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
export const duration = minutes => `${Math.floor(minutes/60)}h ${Math.round(minutes%60)}m`;
const overlap=(a,b,c,d)=>Math.max(0,Math.min(b,d)-Math.max(a,c));
function unionMinutes(intervals){
 let end=-Infinity,total=0;
 for(const [a,b] of intervals.sort((a,b)=>a[0]-b[0])){total+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b)}
 return total/60000;
}
export function dailyWork(plan,date){
 const start=Date.parse(date+'T00:00:00+08:00'),end=start+86400000;
 const open=start+(plan?.availability?.open_hour ?? 8)*3600000,close=start+(plan?.availability?.close_hour ?? 20)*3600000;
 const orders=plan?.orders || [],tasks=[];
 for(const order of orders.filter(o=>['pending','processing'].includes(o.status))){
  const saved=order.preparation_plan?.tasks || [];
  const rows=saved.length?saved:order.preparation_at && order.preparation_end_at?[{name:'Preparation window needs review',menu:order.items.map(i=>i.product_name).join(', '),start:order.preparation_at,end:order.preparation_end_at,worker:true,resource:'all',legacy:true}]:[];
  rows.forEach((task,index)=>{const a=Date.parse(task.start),b=Date.parse(task.end);if(overlap(a,b,start,end)>0)tasks.push({...task,orderId:order.id,key:`${order.id}-${index}`,conflicts:[],dayMinutes:overlap(a,b,start,end)/60000});});
 }
 tasks.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
 const equipmentConflicts=[],closureConflicts=[];
 const closures=(plan?.availability?.blocks || []).map(b=>({start:Math.max(start,Date.parse(b.start_at)),end:Math.min(end,Date.parse(b.end_at)),reason:b.reason || 'Blocked kitchen time'})).filter(b=>b.end>b.start);
 for(let i=0;i<tasks.length;i++){
  const task=tasks[i],a=Math.max(start,Date.parse(task.start)),b=Math.min(end,Date.parse(task.end));
  for(const closure of closures){
   const c=closure.start,d=closure.end;
   if(overlap(a,b,c,d)>0){task.closureConflict=true;task.conflicts.push({kind:'closure',name:closure.reason,start:Math.max(a,c),end:Math.min(b,d)});closureConflicts.push([Math.max(a,c),Math.min(b,d)])}
  }
  for(let j=i+1;j<tasks.length;j++){
   const other=tasks[j],c=Math.max(start,Date.parse(other.start)),d=Math.min(end,Date.parse(other.end));
   const sameEquipment=task.resource==='all' || other.resource==='all' || (task.resource && task.resource!=='none' && task.resource===other.resource);
   if(overlap(a,b,c,d)>0 && (sameEquipment || (task.worker && other.worker))){
    const kind=sameEquipment && task.worker && other.worker?'Equipment and worker':sameEquipment?'Equipment':'Worker';
    task.conflicts.push({kind,name:other.name,orderId:other.orderId,start:Math.max(a,c),end:Math.min(b,d)});
    other.conflicts.push({kind,name:task.name,orderId:task.orderId,start:Math.max(a,c),end:Math.min(b,d)});
   }
   if(sameEquipment && overlap(a,b,c,d)>0){task.equipmentConflict=true;other.equipmentConflict=true;equipmentConflicts.push([Math.max(a,c),Math.min(b,d)])}
  }
 }
 const blocks=(plan?.availability?.blocks || []).map(b=>[Math.max(open,Date.parse(b.start_at)),Math.min(close,Date.parse(b.end_at))]).filter(([a,b])=>b>a);
 const hands=tasks.filter(t=>t.worker),handsMinutes=hands.reduce((n,t)=>n+t.dayMinutes,0);
 const intervals=hands.map(t=>[Math.max(start,Date.parse(t.start)),Math.min(end,Date.parse(t.end))]);
 return {tasks,equipmentConflictMinutes:unionMinutes(equipmentConflicts),closureConflictMinutes:unionMinutes(closureConflicts),handsMinutes,outsideHoursMinutes:hands.reduce((n,t)=>n+t.dayMinutes-overlap(Date.parse(t.start),Date.parse(t.end),open,close)/60000,0),availableMinutes:Math.max(0,(close-open)/60000-unionMinutes(blocks)),conflictingMinutes:Math.max(0,handsMinutes-unionMinutes(intervals)),deliveries:orders.filter(o=>o.delivery_at && malaysiaDate(o.delivery_at)===date),unscheduled:orders.filter(o=>['pending','processing'].includes(o.status) && !o.preparation_plan?.tasks?.length)};
}
