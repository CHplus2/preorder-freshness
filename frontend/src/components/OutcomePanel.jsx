import {useEffect,useState} from 'react';
import axios from 'axios';
import {apiError} from '../utils/apiError';
const date=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
export default function OutcomePanel(){
  const [range,setRange]=useState(()=>({start:date(Date.now()-27*86400000),end:date(Date.now())}));
  const [applied,setApplied]=useState(range),[report,setReport]=useState(null),[metrics,setMetrics]=useState(null),[error,setError]=useState('');
  useEffect(()=>{const c=new AbortController();
    Promise.all([axios.get('/api/admin/contribution/',{params:applied,signal:c.signal}),axios.get('/api/admin/recommendation-metrics/',{signal:c.signal})])
      .then(([a,b])=>{setReport(a.data);setMetrics(b.data)}).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))});return()=>c.abort();},[applied]);
  return <section className="dk-panel"><h2>Order contribution and recommendation outcomes</h2>
    <form className="fyp-form inline" onSubmit={e=>{e.preventDefault();setReport(null);setMetrics(null);setError('');setApplied({...range})}}>
      <label>Orders placed from<input type="date" required value={range.start} onChange={e=>setRange({...range,start:e.target.value})}/></label>
      <label>Through<input type="date" required min={range.start} value={range.end} onChange={e=>setRange({...range,end:e.target.value})}/></label><button>Apply / refresh</button>
    </form>{error && <p role="alert">{error}</p>}
    {!report && !error && <p role="status">Loading outcomes…</p>}
    {report && <><p>{report.definition}</p><p><strong>RM {report.known_contribution}</strong> known food contribution across {report.complete_orders} complete orders. Showing {report.shown} of {report.order_count} orders.</p>
      {report.rows.map(r=><details key={r.order}><summary>Order #{r.order} · {r.status} · {r.food_contribution===null?'Contribution unavailable':`RM ${r.food_contribution} contribution`}</summary>
        <p>Net realised food revenue: RM {r.net_food_revenue} · Known ingredient costs: RM {r.known_ingredient_cost} · Accepted packaging estimate: RM {r.accepted_packaging_cost}</p>
        {!r.realised && <p>Contribution is calculated after delivery or a cooked cancellation.</p>}
        {r.missing.length>0 && <ul>{r.missing.map(m=><li key={m}>{m}</li>)}</ul>}
        <h3>Ingredients actually consumed</h3><ul>{r.trace.map((t,i)=><li key={i}>{t.menu}: {t.quantity} {t.unit} {t.material}, batch #{t.batch} {t.batch_code}, recorded expiry {t.recorded_expiry}. Unit cost: {t.unit_cost===null?'unknown':`RM ${t.unit_cost}/${t.unit}`}</li>)}</ul>
      </details>)}
    </>}
    {metrics && <><h3>Recommendations · last {metrics.days} days</h3><p>{metrics.definition}</p>
      <p>{metrics.experiment_enabled?'Random assignment enabled for popularity and personalised ranking.':'Observational mode. A conversion percentage is not evidence of improvement over a baseline.'}</p>
      {metrics.rows.length===0?<p>No rendered recommendation results recorded yet.</p>:metrics.rows.map(r=><p key={r.variant}><strong>{r.variant}</strong>: {r.exposed_sessions} exposures, {r.clicked_sessions} clicked, {r.ordered_sessions} ordered, {r.paid_sessions} paid ({r.paid_percent}%).</p>)}
    </>}
  </section>;
}
