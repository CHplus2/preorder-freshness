import {duration,savedPlanIssue} from '../utils/planner';

export default function PlanTimingNotice({order,now}) {
 const issue=savedPlanIssue(order,now),demo=order.preparation_plan?.fictional_timing;
 return <>{issue && <div className="admin-notice error" role="alert"><strong>Saved timing needs review</strong><p>{issue}</p></div>}
 {demo && <div className="admin-notice" role="note"><strong>Fictional demo timing</strong><p>These early-finish allowances are scenario assumptions, not verified food holding or storage limits.</p><ul>{(demo.allowances || []).map((row,i)=><li key={i}>{row.menu}: up to {duration(row.maximum_early_finish_minutes)} before dispatch.</li>)}</ul></div>}</>;
}
