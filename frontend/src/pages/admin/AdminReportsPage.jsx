import './SalesWorkspace.css';
import {useStorefront} from '../../contexts/StorefrontContext';
import {Link,useLocation} from 'react-router-dom';
import {DailyOrderReport,PeriodSalesReport} from '../../components/ClientReports';
import RecommendationReport from '../../components/RecommendationReport';
import BatchTrace from '../../components/BatchTrace';
import CostPanel from '../../components/CostPanel';
import OutcomePanel from '../../components/OutcomePanel';
import {salesSummary,menuSales} from '../../utils/salesResponse';
import {readApiError} from '../../utils/apiError';
import { useEffect, useState } from "react";
import axios from 'axios';

function HistoricalReports() {
 const [report,setReport]=useState([]),[summary,setSummary]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  Promise.all([axios.get('/api/admin/reports/sales/',{signal:controller.signal}),axios.get('/api/admin/analytics/',{signal:controller.signal})])
   .then(([a,b])=>{const rows=menuSales(a.data),summary=salesSummary(b.data);if(!controller.signal.aborted){setReport(rows);setSummary(summary);}})
   .catch(e=>{if(!axios.isCancel(e))setError(readApiError(e));})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[retry]);
 const ready=!loading && !error && summary!==null;

 const max=Math.max(1,...(summary?.analytics.trend || []).map(d=>Number(d.sales)));
 return <section><div className="admin-page-heading"><div><h2>Historical analytics</h2><p>These older analytics can include generated history and use placement dates when delivery dates are missing. Use Sales by delivery date above for the client’s dated sales report.</p></div><button disabled={loading} onClick={()=>{setLoading(true);setError('');setReport([]);setSummary(null);setRetry(n=>n+1)}}>{loading?'Loading historical analytics…':'Refresh historical analytics'}</button></div>{error && <p role="alert">{error}</p>}
 {ready && summary.analytics.synthetic_history_orders>0 && <p role="status"><strong>Synthetic sales history included.</strong> Generated daily summaries affect sales totals and average order values. These figures demonstrate a scenario; they are not actual customer revenue or real-world accuracy.</p>}
 <div id="sales-overview" tabIndex={-1} className="inventory-summary" aria-busy={loading}>{[['Net food sales · 28 days','RM '+(summary?.analytics.net_food_sales || '0')],['Paid orders · 28 days',summary?.analytics.paid_orders || 0],['Average food order','RM '+(summary?.analytics.average_order_value || '0')],['Next 7 days · estimate',summary?.forecast.next_7_days_portions==null?'Insufficient history':summary.forecast.next_7_days_portions+' portions']].map(([label,value])=><article className="summary-card" key={label}><span>{label}</span><strong>{loading ? 'Loading…' : error ? 'Unavailable' : value}</strong></article>)}</div>
 <section className="dk-panel"><h2>Last 7 days</h2><p>Net food sales by delivery date, with preorder-date estimates for missing delivery dates.</p>{!ready && <p>{loading?'Loading daily sales…':'Daily sales unavailable. Refresh sales to try again.'}</p>}{ready && summary.analytics.trend.map(d=><div className="dk-sales-row" key={d.date}><span>{d.date}</span><div><span aria-hidden="true" style={{display:'block',height:18,width:`${Number(d.sales)/max*100}%`,background:'#477b4f',borderRadius:3}}/></div><strong>RM {Number(d.sales).toFixed(2)}</strong></div>)}</section>
 <section id="menu-performance" tabIndex={-1} className="dk-panel"><h2>Menu performance · all time</h2><p>Gross food sales before bulk discounts. Use this to spot popular menus; it does not measure profit or marketing conversion.</p>{!loading && !error && report.length===0 && <p>No paid sales yet.</p>}{!ready && <p>{loading?'Loading menu performance…':'Menu performance unavailable. Refresh sales to try again.'}</p>}{ready && report.map(item=><div className="dk-sales-row" key={item.product__id ?? item.product_name}><strong>{item.product_name}</strong><span>{item.total_quantity} portions</span><span>RM {Number(item.total_revenue).toFixed(2)}</span></div>)}</section><section className="dk-panel"><h2>Sales forecast: next 7 days</h2><p>{ready?summary.forecast.method:loading?'Loading forecast…':'Forecast unavailable. Refresh sales to try again.'}</p>{ready && summary.forecast.validation_mae!=null && <p>Recent validation error: about {summary.forecast.validation_mae} portions per day. This is historical error, not a guaranteed accuracy range.</p>}<p>Use confirmed preorders first when buying ingredients. This forecast estimates delivered portions from past delivery dates; it does not replace your delivery calendar or measure profit.</p></section><RecommendationReport/><BatchTrace/></section>;
}

export default function AdminReportsPage() {
 const [historyOpen,setHistoryOpen]=useState(false);
 const {hash}=useLocation();
 const view=hash==='#costs'?'costs':hash==='#order-contribution'?'outcomes':'sales';
 const simple=useStorefront()?.store?.ordering_mode!=='scheduled';
 return <main className="dk-workspace sales-workspace"><div className="admin-page-heading"><div><span className="admin-kicker">YOUR KITCHEN</span><h1>{simple?'Sales & costs':'Orders & sales'}</h1><p>See recorded sales, compare menu prices and review food costs.</p></div><Link className="sales-orders-link" to="/admin/orders?view=daily">Daily order summary</Link></div><nav className="sales-section-links" aria-label="Sales views">{[['sales','Sales overview','#period-sales'],['costs','Costs & pricing','#costs'],['outcomes','Order contribution','#order-contribution']].map(([key,label,target])=><Link key={key} to={target} aria-current={view===key?'page':undefined}>{label}</Link>)}</nav>
  {view==='costs'?<CostPanel/>:view==='outcomes'?<OutcomePanel/>:<>{!simple&&<DailyOrderReport/>}<PeriodSalesReport/><details id="historical-reports" className="historical-reports" onToggle={event=>setHistoryOpen(event.currentTarget.open)}><summary>More analytics & forecasts</summary>{historyOpen&&<HistoricalReports/>}</details></>}
 </main>;
}
