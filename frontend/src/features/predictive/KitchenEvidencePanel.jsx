import {Link} from 'react-router-dom';
import KitchenReadiness from './KitchenReadiness';

const methodNames={mean_28:'28-day moving average',mean_7:'7-day moving average',same_weekday:'Same-weekday baseline'};
const reasonNames={outside_horizon:'Outside this planning window',not_paid:'Payment not confirmed',schedule_needs_review:'Preparation plan needs review',overdue_preparation:'Preparation is overdue'};

export default function KitchenEvidencePanel({plan, open, onToggle, panelRef, children}) {
  const groups=plan.excluded_orders.reduce((result,order)=>{(result[order.reason] ||= []).push(order);return result;},{});
  const methods=plan.decision_support.menus.filter(menu=>menu.forecast_portions!==null).reduce((counts,menu)=>({...counts,[menu.method]:(counts[menu.method]||0)+1}),{});
  const rules=[...new Set([...plan.decision_support.assumptions,...plan.warnings])].filter(Boolean);
  return <details id="kitchen-data-checks" className="pd-card local-evidence-panel" ref={panelRef} open={open} onToggle={event=>{if(event.target===event.currentTarget)onToggle(event.currentTarget.open);}}>
    <summary>Evidence &amp; data checks{plan.excluded_orders.length>0 ? ` · ${plan.excluded_orders.length} excluded orders` : ''}</summary>
    <p>These checks explain what is included in the estimates. They do not change orders, stock or forecasts.</p>
    <section aria-label="Planning essentials"><h3>What to know before acting</h3><ul>
      <li>Forecasts estimate additional demand. Confirmed bookings and their ingredient requirements are tracked separately.</li>
      <li>Stock is used in expiry order, only when it is available on the required date. The planner still checks preparation, capacity and freshness.</li>
      <li>Lower/higher-demand scenarios are assumptions, not probability ranges. Missing sales or waste records do not establish zero demand or zero waste.</li>
      {plan.decision_support.synthetic_history_items>0 && <li>Generated history is included. These results demonstrate the workflow; they do not establish real customer accuracy.</li>}
    </ul></section>
    <details><summary>Orders included in stock planning · {plan.coverage.included_orders}</summary>
      <p>Only paid, pending/processing orders with reviewed dates, complete accepted recipes and undeducted stock qualify. Orders outside the selected dates are excluded even when otherwise valid.</p>
      {!plan.excluded_orders.length ? <p>No orders are excluded from this plan.</p> : <>
        <ul className="local-coverage-groups">{Object.entries(groups).map(([reason,orders])=><li key={reason}><strong>{orders.length}</strong> {reasonNames[reason] || reason.replaceAll('_',' ')}</li>)}</ul>
        <details><summary>Individual excluded order references</summary><ul>{plan.excluded_orders.map(order=><li key={order.order_id}>Order #{order.order_id}: {reasonNames[order.reason] || order.reason.replaceAll('_',' ')}</li>)}</ul></details>
      </>}
      <div className="fc-workflow-links"><Link to="/admin/orders">Review orders</Link><Link to="/admin/planner">Review preparation plans</Link></div>
    </details>
    <details><summary>Forecast coverage &amp; methods</summary>
      <p>Each menu uses a 28-day moving average, 7-day moving average or same-weekday baseline. With at least 42 history days, the lowest validation MAE selects the method; the latest 14 days are held out for testing. Sparse history uses a limited 28-day baseline.</p>
      {Object.keys(methods).length ? <ul>{Object.entries(methods).map(([method,count])=><li key={method}>{count} {count===1?'menu':'menus'} · {methodNames[method] || method.replaceAll('_',' ')}</li>)}</ul> : <p>No menu forecasts are available yet. Review history and recipe coverage below.</p>}
      <KitchenReadiness plan={plan}/>
    </details>
    {children}
    <details><summary>Detailed calculation rules &amp; source notes</summary>
      {rules.length ? <ul>{rules.map(rule=><li key={rule}>{rule}</li>)}</ul> : <p>No additional calculation notes were returned.</p>}
    </details>
  </details>;
}
