function outcomeLabel(row) {
  if(row.food_contribution!==null)return `RM ${row.food_contribution} food contribution`;
  if(!row.realised)return row.status==='delivered'?'Outcome records incomplete':row.status==='cancelled'?'No cooked outcome recorded':'Not realised yet';
  if(row.payment_status==='unpaid')return 'Payment evidence incomplete';
  return row.missing.length?'Cost records incomplete':'Contribution unavailable';
}

export function ContributionSummary({report}) {
  return <div className="contribution-overview">
    {!report.shown ? <p>No orders were placed in this date range.</p> : report.complete_orders>0 ? <p><strong>RM {report.known_contribution}</strong> food contribution from {report.complete_orders} {report.complete_orders===1?'order':'orders'} with complete outcome and cost records. {report.shown-report.complete_orders} shown orders remain uncalculated.</p> : <p><strong>Contribution total unavailable.</strong> None of the shown orders has complete outcome and cost records. This does not mean RM 0 profit.</p>}
    <p>Showing {report.shown} of {report.order_count} orders, grouped by <strong>date placed</strong>. Sales trends and FreshCast forecasts use delivery dates instead.</p>
  </div>;
}

export function OrderContribution({row:r}) {
  return <details className="contribution-order"><summary>Order #{r.order} · {r.status} · {outcomeLabel(r)}</summary>
    {r.food_contribution===null && <p>{!r.realised ? r.status==='delivered' ? 'Delivery status alone does not establish recorded ingredient use. Review the missing outcome evidence below.' : r.status==='cancelled' ? 'No cooked cancellation is recorded. This report calculates fulfilled orders or cooked cancellations with complete costs.' : 'This order has no realised food contribution yet. Delivery or a cooked cancellation and complete ingredient-use records are required.' : 'Required cost or payment evidence is incomplete. Review the reasons below; current recipe estimates cannot replace missing historical costs.'}</p>}
    <dl className="contribution-values"><div><dt>Net realised food revenue</dt><dd>RM {r.net_food_revenue}</dd></div><div><dt>Known ingredient cost subtotal</dt><dd>RM {r.known_ingredient_cost}</dd></div><div><dt>Known accepted packaging estimate</dt><dd>RM {r.accepted_packaging_cost}</dd></div></dl>
    {r.missing.length>0 && <><p>Known subtotals may be incomplete; missing costs are not treated as zero.</p><details className="contribution-missing"><summary>Missing evidence ({r.missing.length})</summary><ul>{r.missing.map(m=><li key={m}>{m}</li>)}</ul></details></>}
    <h3 className="contribution-subheading">Recorded ingredient use</h3>{r.trace.length===0 ? <p>No ingredient use recorded for this order yet.</p> : <ul>{r.trace.map((t,i)=><li key={i}>{t.menu}: {t.quantity} {t.unit} {t.material}, batch #{t.batch} {t.batch_code}, recorded expiry {t.recorded_expiry}. Unit cost: {t.unit_cost===null?'unknown':`RM ${t.unit_cost}/${t.unit}`}</li>)}</ul>}
  </details>;
}
