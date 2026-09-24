import {malaysiaDate} from '../utils/planner';
export default function PlannerCalendar({date,onChange,orders=[]}){
 const month=date.slice(0,7),first=new Date(month+'-01T12:00:00+08:00');
 const offset=(first.getUTCDay()+6)%7;
 const days=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
 const counts={};
 for(const order of orders){
  if(order.delivery_at){const key=malaysiaDate(order.delivery_at);counts[key]??={tasks:0,deliveries:0};counts[key].deliveries++}
  if(!['pending','processing'].includes(order.status))continue;
  for(const task of order.preparation_plan?.tasks || []){
   for(let n=1;n<=days;n++){
    const key=month+'-'+String(n).padStart(2,'0'),start=Date.parse(key+'T00:00:00+08:00');
    if(Date.parse(task.start)<start+86400000 && Date.parse(task.end)>start){counts[key]??={tasks:0,deliveries:0};counts[key].tasks++}
   }
  }
 }
 const changeMonth=n=>{const d=new Date(month+'-15T12:00:00+08:00');d.setUTCMonth(d.getUTCMonth()+n);onChange(malaysiaDate(d).slice(0,7)+'-01')};
 return <section className="planner-calendar" aria-label="Monthly preparation and delivery calendar">
 <div className="admin-page-heading"><h2>{first.toLocaleDateString('en-MY',{month:'long',year:'numeric',timeZone:'Asia/Kuala_Lumpur'})}</h2><div className="admin-toolbar"><button onClick={()=>changeMonth(-1)} aria-label="Previous month">Previous month</button><button onClick={()=>changeMonth(1)} aria-label="Next month">Next month</button></div></div>
 <p>Select a day to see its tasks below. Counts include recorded task plans and deliveries.</p>
 <div className="calendar-grid">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span className="calendar-weekday" key={d}>{d}</span>)}
 {Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}
 {Array.from({length:days},(_,i)=>{const key=month+'-'+String(i+1).padStart(2,'0'),count=counts[key];return <button key={key} aria-pressed={key===date} aria-label={key+': '+(count?.tasks||0)+' tasks, '+(count?.deliveries||0)+' deliveries'} onClick={()=>onChange(key)}><strong>{i+1}</strong>{count?.tasks>0 && <small>{count.tasks} tasks</small>}{count?.deliveries>0 && <small>{count.deliveries} deliveries</small>}</button>})}</div></section>
}
