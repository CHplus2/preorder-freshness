import { useEffect, useState } from 'react';
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
    <h2>Your website orders & local baseline</h2>
    <p>A four-week moving average uses this website’s database, without Genpact. Sales are grouped by delivery week; missing delivery dates use a marked preorder-date estimate.</p>
    {current.loading && <p role="status">Evaluating kitchen history…</p>}
    {current.error && <p role="alert">{current.error}</p>}
    {data && <>
      <p><strong>{data.database_coverage?.total_orders ?? data.eligible_orders} orders loaded from your website</strong> · {data.eligible_orders} paid, delivered historical orders · {data.estimated_date_orders} estimated sales dates</p>
      {data.baseline?.next_week_portions != null ? <>
        <p><strong>{data.baseline.next_week_portions} portions</strong> · sales baseline for the full week starting {data.forecast_week_start}.</p>
        <p>Trailing four completed weeks, including weeks with zero recorded sales. This is a baseline estimate, not a Genpact prediction.</p>
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
        <p>Model choice: {data.selected_method.replaceAll('_', ' ')} · {data.next_week_portions} portions. The baseline above remains the starting point.</p>
        <div className="pd-table-wrap"><table><caption>Chronological test · {data.evaluation.test_start}–{data.evaluation.test_end} · portions per week</caption>
        <thead><tr><th>Method</th><th>MAE</th><th>WAPE</th></tr></thead>
        <tbody>{Object.entries(data.evaluation.test).map(([method, score]) => <tr key={method}><th>{method.replaceAll('_', ' ')}</th><td>{score.mae_portions_per_week}</td><td>{score.wape_percent === null ? 'Undefined: zero actual sales' : `${score.wape_percent}%`}</td></tr>)}</tbody>
      </table><p>{data.evaluation.train_weeks} training weeks · {data.evaluation.validation_weeks} validation weeks · {data.evaluation.test_weeks} test weeks. Rolling one-week forecasts use only earlier observations.</p></div></details>}
      {!data.evaluation && <p>Start with the local baseline. A separate local model comparison becomes available with at least 14 completed sales weeks.</p>}
      <details><summary>Prepared history and assumptions</summary><ul>{data.warnings.map(w => <li key={w}>{w}</li>)}</ul>
        <div className="pd-table-wrap"><table><caption>{data.history.length ? 'Recorded sales' : 'Recorded preorders, including unpaid or unfinished orders'} by effective delivery week</caption><thead><tr><th>Week</th><th>Orders</th><th>Portions</th></tr></thead><tbody>{(data.history.length ? data.history : data.recorded_preorders?.history || []).map(row => <tr key={row.week_start}><td>{row.week_start}</td><td>{row.orders}</td><td>{row.portions}</td></tr>)}</tbody></table></div>
      </details>
    </>}
  </section>;
}
