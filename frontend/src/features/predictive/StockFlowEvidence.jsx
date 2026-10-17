const qty = value => new Intl.NumberFormat('en-MY', {maximumFractionDigits: 3}).format(value);
const money = value => value == null ? 'Unknown cost' : new Intl.NumberFormat('en-MY', {style: 'currency', currency: 'MYR'}).format(value);

export default function StockFlowEvidence({risk, window}) {
  const flow = risk.stock_flow;
  if (!flow) return <p>Projected waste counts only unused stock expiring within the selected window. Stock dated later carries forward; demand after a batch expires cannot consume that batch.</p>;
  const expiring = flow.batches.filter(b => b.expires_in_window);
  return <section className="local-expiry-evidence" aria-label="Ingredient stock calculation">
    <h3>How Step 1’s expiry result is produced</h3>
    <p><strong>{risk.ingredient_name}</strong> · {window.horizon_days || 'Selected'}-day window · {window.start_date}–{window.end_date} inclusive.</p>
    <ol className="local-evidence-chain" aria-label="Expiry calculation sequence">
      <li><strong>1 · Find expiring lots</strong><span>Only eligible batches expiring by {window.end_date} can contribute to this window’s waste.</span></li>
      <li><strong>2 · Allocate dated demand</strong><span>Confirmed recipes first, then additional forecast portions × current recipes. Earliest usable expiry first.</span></li>
      <li><strong>3 · Count unused remainder</strong><span>{qty(risk.forecast_expiring_unused)} {risk.unit} projected unused at expiry · {money(risk.forecast_waste_cost_myr)} estimated exposure.</span></li>
    </ol>
    <div className="local-expiry-lots">
      {expiring.map(b => <article key={b.batch_id}>
        <header><strong>{b.batch_code || `Batch ${b.batch_id}`}</strong><span>Expires {b.expiry_date}</span></header>
        <p>{qty(b.opening_quantity)} {risk.unit} starting stock − {qty(b.confirmed_allocated)} {risk.unit} confirmed use − {qty(b.forecast_consumed)} {risk.unit} forecast use before expiry = <strong>{qty(b.projected_remaining)} {risk.unit} projected unused</strong>.</p>
        <div className="local-stock-bar" role="img" aria-label={`Batch ${b.batch_id}: ${qty(b.confirmed_allocated)} confirmed use, ${qty(b.forecast_consumed)} forecast use, ${qty(b.projected_remaining)} remaining ${risk.unit}`}>
          {[['confirmed', b.confirmed_allocated], ['forecast', b.forecast_consumed], ['unused', b.projected_remaining]].map(([name, value]) => <span key={name} className={name} style={{width: `${b.opening_quantity > 0 ? 100 * value / b.opening_quantity : 0}%`}} />)}
        </div>
        <p className="local-stock-legend">Confirmed use · Forecast use · Unused at expiry</p>
        <p>Recorded unit cost: {b.unit_cost == null ? 'Unknown cost' : `RM ${new Intl.NumberFormat('en-MY', {maximumFractionDigits: 6}).format(b.unit_cost)} / ${risk.unit}`}.</p>
        <details><summary>When this lot is projected to be used</summary>
          {flow.allocations.filter(a => a.batch_id === b.batch_id).length ? <ul>{flow.allocations.filter(a => a.batch_id === b.batch_id).map(a => <li key={a.date}>{a.date}: {qty(a.quantity)} {risk.unit} additional forecast use</li>)}</ul> : <p>No additional forecast use fits this lot before its expiry.</p>}
          <p>Confirmed allocations are shown separately in the stock breakdown. Demand after {b.expiry_date} cannot rescue this batch.</p>
        </details>
      </article>)}
      {!expiring.length && <p>No eligible batches expire within this window. Later-dated stock is excluded from this window’s waste calculation.</p>}
    </div>
    {risk.forecast_expiring_unused === 0 && <p>No unused eligible stock is projected to expire in this window. Check the uncovered demand below: zero projected waste can coexist with a shortage.</p>}
    <details>
      <summary>Trace menu portions → ingredient need → dated stock use</summary>
      <p>Additional forecast need: <strong>{qty(risk.forecast_requirement)} {risk.unit}</strong>. Dated stock covers <strong>{qty(flow.forecast_consumed)} {risk.unit}</strong>; <strong>{qty(risk.forecast_shortfall)} {risk.unit}</strong> remains uncovered.</p>
      {flow.demand_by_day?.map(day => <details key={day.date}>
        <summary>{day.date} · {qty(day.forecast_requirement)} {risk.unit} needed · {qty(day.forecast_consumed)} {risk.unit} covered</summary>
        <ul>{day.menus.map(menu => <li key={menu.product_id}>{menu.product_name}: {qty(menu.additional_portions)} additional portions × {qty(menu.quantity_per_portion)} {risk.unit} per portion = {qty(menu.requirement)} {risk.unit}</li>)}</ul>
      </details>)}
    </details>
    <details>
      <summary>Whole-stock balance, including batches expiring later</summary>
      <p>{qty(flow.opening_quantity)} {risk.unit} eligible stock − {qty(flow.confirmed_allocated)} {risk.unit} allocated to confirmed orders − {qty(flow.forecast_consumed)} {risk.unit} projected forecast use = <strong>{qty(flow.projected_total_remaining)} {risk.unit} remaining</strong>.</p>
      <div className="fc-facts">
        <div><span>Remaining stock expiring by {window.end_date}</span><strong>{qty(flow.projected_expiring_unused)} {risk.unit}</strong><small>Projected waste within this window</small></div>
        <div><span>Remaining stock dated after {window.end_date}</span><strong>{qty(flow.projected_carried_stock)} {risk.unit}</strong><small>Carried beyond this window</small></div>
      </div>
      <div className="pd-table-wrap"><table>
        <caption>Earliest expiry first · native ingredient units · projected allocation, no stock deducted</caption>
        <thead><tr><th>Batch</th><th>Expiry</th><th>After confirmed orders</th><th>Forecast use</th><th>Remaining</th><th>Treatment</th><th>Estimated unit cost</th></tr></thead>
        <tbody>{flow.batches.map(b => <tr key={b.batch_id}><th>{b.batch_code || `Batch ${b.batch_id}`}</th><td>{b.expiry_date}</td><td>{qty(b.after_confirmed)} {risk.unit}</td><td>{qty(b.forecast_consumed)} {risk.unit}</td><td>{qty(b.projected_remaining)} {risk.unit}</td><td>{b.expires_in_window ? 'Unused remainder counts as projected waste' : 'Remaining stock carries forward'}</td><td>{b.unit_cost === null ? 'Unknown' : `RM ${new Intl.NumberFormat('en-MY', {maximumFractionDigits: 6}).format(b.unit_cost)} / ${risk.unit}`}</td></tr>)}</tbody>
      </table></div>
    </details>
    <p>Figures are rounded for display. Recorded costs and synthetic scenario inputs retain their existing labels.</p>
  </section>;
}
