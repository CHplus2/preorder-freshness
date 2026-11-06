import {Link} from 'react-router-dom';

function outcomeLabel(row){
 if(row.food_contribution!==null)return `RM ${row.food_contribution} food contribution`;
 if(!row.realised)return row.status==='delivered'?'Ingredient use not recorded':row.status==='cancelled'?'Cancelled · no received-order contribution':'Not received yet';
 if(row.payment_status==='unpaid')return 'Payment not confirmed';
 return row.missing.length?'Cost records missing':'Contribution unavailable';
}
const receiptLabel=status=>status==='delivered'?'Received':status==='cancelled'?'Cancelled':'Not received';

export function ContributionSummary({report}){
 return <div className="contribution-overview">
  {!report.shown?<p>No orders were placed in this date range.</p>:report.complete_orders>0?<p><strong>RM {report.known_contribution}</strong> food contribution from {report.complete_orders} {report.complete_orders===1?'order':'orders'} with complete records. {report.shown-report.complete_orders} shown orders cannot be calculated yet.</p>:<p><strong>Contribution total unavailable.</strong> The shown orders are awaiting receipt/payment confirmation or have missing historical costs. Missing costs are not counted as zero.</p>}
  <p className="cost-scope-note">Showing {report.shown} of {report.order_count} orders by <strong>date placed</strong>. Sales overview uses delivery dates.</p>
 </div>;
}

export function OrderContribution({row:r}){
 return <details className="contribution-order"><summary><span className="contribution-order-id">Order #{r.order}<small>{receiptLabel(r.status)}</small></span><span className={'contribution-order-result '+(r.food_contribution===null?'is-incomplete':'')}>{outcomeLabel(r)}</span></summary>
  <div className="contribution-order-body">
   {r.food_contribution===null&&<p>{!r.realised?r.status==='delivered'?'This order is marked received, but its ingredient-use record is incomplete.':r.status==='cancelled'?'This cancelled order has no received-order contribution. Check unused stock returns separately.':'Contribution is calculated after the food is received and the required cost/payment records are complete.':r.payment_status==='unpaid'?'The food is marked received, but payment has not been confirmed. Review the payment record in Orders.':'Ingredient purchase costs or accepted packaging costs were not recorded. Current recipe estimates do not rewrite historical costs.'}</p>}
   <dl className="contribution-values"><div><dt>Recorded food revenue</dt><dd>RM {r.net_food_revenue}</dd></div><div><dt>Known ingredient costs</dt><dd>RM {r.known_ingredient_cost}</dd></div><div><dt>Known packaging costs</dt><dd>RM {r.accepted_packaging_cost}</dd></div></dl>
   <p><Link to={`/admin/orders?order=${r.order}`}>Review order #{r.order}</Link></p>
   {r.missing.length>0&&<><p>Known subtotals may be incomplete; missing costs are not treated as zero.</p><details className="contribution-missing"><summary>Missing records ({r.missing.length})</summary><ul>{r.missing.map(missing=><li key={missing}>{missing}</li>)}</ul></details></>}
   <details className="contribution-missing"><summary>Ingredient allocation details</summary>{!r.trace.length?<p>No ingredient use recorded for this order yet.</p>:<ul>{r.trace.map((trace,index)=><li key={index}>{trace.menu}: {trace.quantity} {trace.unit} {trace.material}, batch {trace.batch_code||'#'+trace.batch}. Recorded expiry: {trace.recorded_expiry}. Unit cost: {trace.unit_cost===null?'not recorded':`RM ${trace.unit_cost}/${trace.unit}`}</li>)}</ul>}</details>
  </div>
 </details>;
}
