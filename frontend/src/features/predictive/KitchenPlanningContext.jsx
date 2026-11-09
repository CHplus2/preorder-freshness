export default function KitchenPlanningContext({plan,evidenceOpen,onReviewEvidence}){
 return <div className="pd-context local-planning-context">
  <span>Stock planning: {plan.window.start_date}–{plan.window.end_date} · {plan.timezone}</span>
  <div className="local-planning-summary">
   <span>{plan.coverage.included_orders} confirmed orders included · {plan.coverage.excluded_orders} excluded</span>
   <button type="button" className="local-evidence-trigger" onClick={onReviewEvidence} aria-controls="kitchen-data-checks" aria-expanded={evidenceOpen}>Review data checks</button>
  </div>
  {!plan.coverage.included_orders && <span className="local-forecast-context">Menu forecasts are separate from confirmed orders.</span>}
 </div>;
}
