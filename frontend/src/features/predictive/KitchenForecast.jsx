import { useEffect, useState } from 'react';
import {Link} from 'react-router-dom';
import { loadLocalForecast } from './localApi';

export default function KitchenForecast({ revision }) {
  const [state, setState] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    loadLocalForecast({ signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ data, revision });
    }).catch(error => { if (!controller.signal.aborted) setState({ error: error.message, revision }); });
    return () => controller.abort();
  }, [revision]);
  const current = state.revision === revision ? state : {loading:true};
  const data = current.data;
  return <section className="pd-card" aria-label="Kitchen demand forecast">
    <h2>Your delivery-based sales forecast</h2>
    <p>Uses this website’s paid, delivered orders, independently of preparation task plans. Sales are grouped by delivery week; missing delivery dates use a marked preorder-date estimate. Genpact data is not used.</p>
    {current.loading && <p role="status">Evaluating kitchen history…</p>}
    {current.error && <p role="alert">{current.error}</p>}
    {data && <>
      <p><strong>{data.database_coverage?.total_orders ?? data.eligible_orders} orders loaded from your website</strong> · {data.eligible_orders} paid, delivered historical orders · {data.estimated_date_orders} estimated sales dates</p>
      {data.next_week_portions != null ? <>
        <p><strong>{data.next_week_portions} portions</strong> · forecast for the full delivery week starting {data.forecast_week_start}.</p>
        <p>Method: {data.selected_method.replaceAll('_', ' ')}. {data.status==='evaluated'?'Selected by chronological validation; held-out test results are below.':'Limited history: a moving-average baseline, without a validated accuracy claim.'}</p>
        {data.status==='evaluated' && data.baseline?.next_week_portions != null && <p>Four-week comparison baseline: {data.baseline.next_week_portions} portions.</p>}
        <p>This total includes confirmed demand; do not add booked portions again. It covers all eligible website products, including archived products in historical orders.</p>
      </> : <>
        <p role="status">No paid, delivered sales from completed weeks qualify for the sales baseline. Your stored orders are still shown below.</p>
        {data.recorded_preorders?.next_week_portions != null && <div><h3>Recorded preorder baseline</h3>
          <p><strong>{data.recorded_preorders.next_week_portions} portions</strong> for the week starting {data.forecast_week_start}, based on {data.recorded_preorders.eligible_orders} past preorders.</p>
          <p>Includes unpaid or unfinished preorders. This estimates recorded order volume, not realised sales. Cancelled and refunded orders are excluded.</p></div>}
      </>}
      {data.database_coverage && <p>{Object.entries(data.database_coverage.by_status).map(([status, count]) => `${count} ${status}`).join(' · ')}</p>}
      {data.recent_orders?.length > 0 && <details><summary>Recorded order details</summary><div className="pd-table-wrap"><table><caption>Latest stored orders · up to 50 · independent of stock-planning eligibility</caption>
        <thead><tr><th>Order</th><th>Delivery / estimated date</th><th>Status</th><th>Payment</th><th>Portions</th></tr></thead>
        <tbody>{data.recent_orders.map(order => <tr key={order.order_id}><td>#{order.order_id}</td><td>{order.sales_date}{order.date_basis === 'preorder_date_fallback' ? ' (preorder-date estimate)' : ''}</td><td>{order.status}</td><td>{order.payment_status}</td><td>{order.portions}</td></tr>)}</tbody>
      </table></div></details>}
      {data.evaluation && <details><summary>Optional model comparison · trained on local sales only</summary>
        <p>Selected method: {data.selected_method.replaceAll('_', ' ')} · {data.next_week_portions} portions. Compare with the four-week baseline on the same held-out period.</p>
        <div className="pd-table-wrap"><table><caption>Chronological test · {data.evaluation.test_start}–{data.evaluation.test_end} · portions per week</caption>
        <thead><tr><th>Method</th><th>MAE</th><th>WAPE</th></tr></thead>
        <tbody>{Object.entries(data.evaluation.test).map(([method, score]) => <tr key={method}><th>{method.replaceAll('_', ' ')}</th><td>{score.mae_portions_per_week}</td><td>{score.wape_percent === null ? 'Undefined: zero actual sales' : `${score.wape_percent}%`}</td></tr>)}</tbody>
      </table><p>{data.evaluation.train_weeks} training weeks · {data.evaluation.validation_weeks} validation weeks · {data.evaluation.test_weeks} test weeks. Rolling one-week forecasts use only earlier observations.</p></div></details>}
      {!data.evaluation && <p>Start with the local baseline. A separate local model comparison becomes available with at least 14 completed sales weeks.</p>}
      <p><Link to="/admin/ai/decisions?source=local">Use active-menu forecasts with recipes and expiry evidence</Link>. The kitchen assistant uses per-menu demand, accepted order recipes and dated stock to guide decisions. Fictional database records remain demo evidence.</p>
      <details><summary>Prepared history and assumptions</summary><ul>{data.warnings.map(w => <li key={w}>{w}</li>)}</ul>
        <div className="pd-table-wrap"><table><caption>{data.history.length ? 'Recorded sales' : 'Recorded preorders, including unpaid or unfinished orders'} by effective delivery week</caption><thead><tr><th>Week</th><th>Orders</th><th>Portions</th></tr></thead><tbody>{(data.history.length ? data.history : data.recorded_preorders?.history || []).map(row => <tr key={row.week_start}><td>{row.week_start}</td><td>{row.orders}</td><td>{row.portions}</td></tr>)}</tbody></table></div>
      </details>
    </>}
  </section>;
}
