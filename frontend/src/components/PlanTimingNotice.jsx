import {duration,savedPlanIssue} from '../utils/planner';

export default function PlanTimingNotice({order,now}) {
 const issue=savedPlanIssue(order,now),demo=order.preparation_plan?.fictional_timing;
 const groups=new Map();
 for(const row of demo?.allowances || [])groups.set(row.maximum_early_finish_minutes,[...(groups.get(row.maximum_early_finish_minutes) || []),row.menu]);
 return <>{issue && <div className="plan-timing-alert" role="alert"><strong>Preparation timing needs review</strong><p>{issue}</p></div>}
 {demo && <details className="plan-demo-assumptions"><summary><span>Demo record</span>Timing assumptions</summary><p>This fictional order uses scenario timing allowances. They are not verified food holding or storage limits.</p><ul>{[...groups].map(([minutes,menus])=><li key={minutes}>{menus.join(', ')}: up to {duration(minutes)} before dispatch.</li>)}</ul></details>}</>;
}
