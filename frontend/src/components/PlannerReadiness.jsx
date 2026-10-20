import {useState} from 'react';
import {planningReadiness} from '../utils/planner';
import PlannerSetup from './PlannerSetup';
export default function PlannerReadiness({menus,orders,onReview,onSaved,now}) {
 const [expanded,setExpanded]=useState(false);
 const groups=planningReadiness(orders,now);
 const reviewCount=Object.values(groups).reduce((sum,rows)=>sum+rows.length,0);
 const needsAttention=reviewCount>0 || menus.length>0;
 return <section className="planner-readiness" aria-label="Kitchen follow-up">
  <button type="button" className="planner-readiness-toggle" aria-expanded={expanded} aria-controls="planner-readiness-details" onClick={()=>setExpanded(open=>!open)}>
   <span><strong>{needsAttention?'Kitchen follow-up':'Kitchen setup ready'}</strong><span>{needsAttention?[reviewCount>0?`${reviewCount} ${reviewCount===1?'order needs':'orders need'} review`:'',menus.length>0?`${menus.length} ${menus.length===1?'menu needs':'menus need'} cooking steps`:''].filter(Boolean).join(' · '):'Cooking steps ready. No outstanding preparation reviews.'}</span></span><span>{expanded?'Hide':'Review'}</span>
  </button>
  {expanded && <div id="planner-readiness-details"><PlannerSetup menus={menus} orders={orders} onReview={onReview} onSaved={onSaved} now={now}/></div>}
 </section>;
}
