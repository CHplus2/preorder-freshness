import {scheduledDelivery} from './planner.js';

const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';

// Unaccepted requests are not commitments. Invalid saved timings must not stop
// reminders for the rest of the kitchen from being downloaded.
export function plannerCalendar(orders, now=new Date()) {
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Dapur Kita//Planner//EN'];
 let events=0,invalidTasks=0;const seenShared=new Set();
 const add=(uid,start,end,summary,alarm=false)=>{
  lines.push('BEGIN:VEVENT',`UID:${uid}@dapur-kita`,`DTSTAMP:${stamp(now)}`,
   `DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${summary}`);
  if(alarm)lines.push('BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY',`DESCRIPTION:${summary}`,'END:VALARM');
  lines.push('END:VEVENT');events++;
 };
 for(const order of orders || []) {
  if(!scheduledDelivery(order))continue;
  const shared=order.preparation_plan?.shared_batch;
  if(['pending','processing'].includes(order.status) && !(shared && seenShared.has(shared.id))) {
   if(shared)seenShared.add(shared.id);
   for(const [index,task] of (order.preparation_plan?.tasks || []).entries()) {
    const start=Date.parse(task.start || ''),end=Date.parse(task.end || '');
    if(!Number.isFinite(start) || !Number.isFinite(end) || end<=start){invalidTasks++;continue;}
    add(`${shared?.id || order.id}-task-${index}`,start,end,shared?`Shared cooking orders ${shared.order_ids.join('/')} step ${index+1}`:`Prepare order ${order.id} step ${index+1}`,true);
   }
  }
  const delivery=Date.parse(order.delivery_at);
  add(`${order.id}-delivery`,delivery,delivery+30*60000,`${order.delivery_method==='pickup'?'Collection for':'Deliver'} order ${order.id}`);
 }
 lines.push('END:VCALENDAR');
 return {content:lines.join('\r\n')+'\r\n',events,invalidTasks};
}
