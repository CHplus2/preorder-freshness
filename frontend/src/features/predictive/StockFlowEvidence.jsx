const qty=value=>new Intl.NumberFormat('en-MY',{maximumFractionDigits:3}).format(value);

export default function StockFlowEvidence({risk,window}) {
 const flow=risk.stock_flow;
 if(!flow)return <p>Projected waste counts only unused stock expiring within the selected window. Stock dated later carries forward; demand after a batch expires cannot consume that batch.</p>;
 return <section aria-label="Ingredient stock calculation">
  <h3>Where the stock goes</h3>
  <p>Additional forecast need: <strong>{qty(risk.forecast_requirement)} {risk.unit}</strong>. Dated stock covers <strong>{qty(flow.forecast_consumed)} {risk.unit}</strong>; <strong>{qty(risk.forecast_shortfall)} {risk.unit}</strong> remains uncovered.</p>
  <p>{qty(flow.opening_quantity)} {risk.unit} eligible stock − {qty(flow.confirmed_allocated)} {risk.unit} allocated to confirmed orders − {qty(flow.forecast_consumed)} {risk.unit} projected forecast use = <strong>{qty(flow.projected_total_remaining)} {risk.unit} remaining</strong>.</p>
  <div className="fc-facts">
   <div><span>Remaining stock expiring by {window.end_date}</span><strong>{qty(flow.projected_expiring_unused)} {risk.unit}</strong><small>Projected waste within this window</small></div>
   <div><span>Remaining stock dated after {window.end_date}</span><strong>{qty(flow.projected_carried_stock)} {risk.unit}</strong><small>Carried beyond this window</small></div>
  </div>
  {risk.forecast_expiring_unused===0 && <p>No unused eligible stock is projected to expire in this window. Check the uncovered demand above: zero projected waste can coexist with a shortage.</p>}
  <details><summary>Inspect the batch-by-batch calculation</summary><div className="pd-table-wrap"><table>
   <caption>Earliest expiry first · native ingredient units · projected allocation, no stock deducted</caption>
   <thead><tr><th>Batch</th><th>Expiry</th><th>After confirmed orders</th><th>Forecast use</th><th>Remaining</th><th>Treatment</th><th>Estimated unit cost</th></tr></thead>
   <tbody>{flow.batches.map(b=><tr key={b.batch_id}><th>{b.batch_code || `Batch ${b.batch_id}`}</th><td>{b.expiry_date}</td><td>{qty(b.after_confirmed)} {risk.unit}</td><td>{qty(b.forecast_consumed)} {risk.unit}</td><td>{qty(b.projected_remaining)} {risk.unit}</td><td>{b.expires_in_window?'Unused remainder counts as projected waste':'Remaining stock carries forward'}</td><td>{b.unit_cost===null?'Unknown':`RM ${new Intl.NumberFormat('en-MY',{maximumFractionDigits:6}).format(b.unit_cost)} / ${risk.unit}`}</td></tr>)}</tbody>
  </table></div></details>
  <p>Only demand before a lot's expiry can use it. Figures are rounded; recorded costs and synthetic scenario inputs retain their existing labels.</p>
 </section>;
}
