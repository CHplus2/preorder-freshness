import { useEffect, useState } from "react";
import axios from 'axios';
import "./AdminReportsPage.css";
export default function AdminReportsPage() {
 const [report,setReport]=useState([]),[summary,setSummary]=useState(null),[error,setError]=useState('');
 useEffect(()=>{Promise.all([axios.get('/api/admin/reports/sales/'),axios.get('/api/admin/planning/')]).then(([a,b])=>{setReport(a.data);setSummary(b.data);}).catch(()=>setError('Sales could not be loaded. Please refresh.'));},[]);
 const max=Math.max(1,...(summary?.analytics.trend || []).map(d=>Number(d.sales)));
 return <main className="dk-workspace"><span className="dk-eyebrow">A CLEARER PICTURE OF YOUR KITCHEN</span><h1>Sales analytics</h1><p>Paid, non-cancelled orders. Net food sales include discounts and exclude delivery fees.</p>{error && <p role="alert">{error}</p>}
 <div className="inventory-summary">{[['Net food sales · 28 days','RM '+(summary?.analytics.net_food_sales || '0')],['Paid orders · 28 days',summary?.analytics.paid_orders || 0],['Average food order','RM '+(summary?.analytics.average_order_value || '0')],['Next 7 days · estimate',(summary?.forecast.next_7_days_portions || 0)+' portions']].map(([label,value])=><article className="summary-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
 <section className="dk-panel"><h2>Last 7 days</h2><p>Net food sales by order placement date.</p>{summary?.analytics.trend.map(d=><div className="dk-sales-row" key={d.date}><span>{d.date}</span><div><span style={{display:'block',height:18,width:`${Number(d.sales)/max*100}%`,background:'#477b4f',borderRadius:3}}/></div><strong>RM {Number(d.sales).toFixed(2)}</strong></div>)}</section>
 <section className="dk-panel"><h2>Menu performance · all time</h2><p>Gross food sales before bulk discounts. Use this to spot popular menus; it does not measure profit or marketing conversion.</p>{report.length===0 && <p>No paid sales yet.</p>}{report.map(item=><div className="dk-sales-row" key={item.product__id ?? item.product_name}><strong>{item.product_name}</strong><span>{item.total_quantity} portions</span><span>RM {Number(item.total_revenue).toFixed(2)}</span></div>)}</section><p>{summary?.forecast.method} This estimate uses paid order quantities, not an AI forecast.</p></main>;
}
