import './TaskConflicts.css';
const time=value=>new Date(value).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',hour12:false});
export default function TaskConflicts({conflicts=[],onReview}){
  if(!conflicts.length)return null;
  return <details className="task-conflicts"><summary>{conflicts.length} scheduling {conflicts.length===1?'conflict':'conflicts'} — review details</summary><ul>{conflicts.map((c,i)=><li key={i}><strong>{c.kind==='closure'?'Kitchen closure':c.kind}</strong><p>{c.name}{c.orderId!=null?` · Order #${c.orderId}`:''}</p><p>Overlap: {time(c.start)}–{time(c.end)} (Malaysia)</p>{c.orderId!=null && <button type="button" onClick={()=>onReview(c.orderId)}>Review order #{c.orderId}</button>}</li>)}</ul><p>Review the saved plan and kitchen availability. Orders are not moved automatically.</p></details>;
}
