import {useCallback, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,Printer} from 'lucide-react';
import useClientReport from '../hooks/useClientReport';
import {dailyReport, periodReport, malaysiaDay, reportMoney, slipUrl} from '../utils/clientReports';
import {arrivalLabel} from '../utils/arrivalWindow';
import './ClientReports.css';

function ReportState({report}) {
 return report.loading ? <p role="status">Loading report…</p> : report.error ? <div className="client-report-error" role="alert"><p>{report.error}</p><button type="button" onClick={report.refresh}>Try again</button></div> : null;
}
function MenuTable({rows, truncated, sales=false}) {
 return <><div className="client-report-scroll" tabIndex={0} role="region" aria-label="Menu totals"><table className={!sales?'client-report-menu-table':undefined}><caption>{sales?'Menu sales before order discounts':'Menu totals · non-cancelled orders for this date'}</caption><thead><tr><th scope="col">Menu</th><th scope="col">Selling units</th>{sales&&<th scope="col">Gross food sales</th>}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}><th scope="row">{row.product_name}</th><td>{row.quantity}</td>{sales&&<td>{reportMoney(row.gross_food)}</td>}</tr>)}</tbody></table></div>{truncated&&<p role="status">First 500 menu entries shown. Overall totals include every matching order. Choose a shorter sales range to see all menus.</p>}</>;
}

export function DailyOrderReport({initialDate,onDateChange,initialReceipt='all',onReceiptChange}={}) {
 const [day, setDay] = useState(()=>initialDate||malaysiaDay()), [query, setQuery] = useState(()=>initialDate||malaysiaDay()), [page, setPage] = useState(1);
 const [receipt,setReceipt]=useState(initialReceipt);
 const validate = useCallback(data => dailyReport(data, query, page,receipt), [query, page,receipt]);
 const report = useClientReport(`/api/admin/reports/daily-orders/?${new URLSearchParams({date:query,page:String(page),receipt})}`, validate);
 const data = report.data;
 if(data&&page>Math.max(1,Math.ceil(data.count/50)))setPage(1);
 return <section id="daily-orders" className="client-report" aria-labelledby="daily-orders-title">
  <header><div><h2 id="daily-orders-title">Daily order summary</h2><p>Delivery and collection on the selected Malaysia date. Cancelled orders and generated sales history are excluded.</p></div><button type="button" onClick={report.refresh} disabled={report.loading}>Refresh summary</button></header>
  <form onSubmit={event=>{event.preventDefault();setPage(1);if(query===day&&page===1)report.refresh();else setQuery(day);onDateChange?.(day,receipt);}}><label>Delivery / collection date<input type="date" required value={day} onChange={event=>setDay(event.target.value)}/></label><button type="submit" disabled={report.loading}>View day</button></form>
  <div className="client-report-receipt-filters" role="group" aria-label="Daily receipt status">{[['all','All orders','day_count'],['not_received','Not received','day_not_received_count'],['received','Received','day_received_count']].map(([value,label,countKey])=><button type="button" key={value} aria-pressed={receipt===value} onClick={()=>{setReceipt(value);setPage(1);onReceiptChange?.(value)}}>{label}{data&&<span>{data[countKey]}</span>}</button>)}</div>
  <ReportState report={report}/>
  {data&&<><p className="client-report-period">Showing {data.date} · {receipt==='all'?'All non-cancelled orders':receipt==='received'?'Received orders':'Not received orders'} · Malaysia time</p><div className="client-report-stats client-report-stats--daily">{[['Orders in view',data.count],['Selling units',data.quantity],['Order value',reportMoney(data.order_value)]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><details className="client-report-explanation"><summary>About these totals</summary><p>Menu quantities and order value follow the selected receipt status. Order value includes food after discounts and delivery fees, whether paid or unpaid. It is not collected sales. {data.cancelled_count>0?`${data.cancelled_count} cancelled ${data.cancelled_count===1?'order':'orders'} excluded.`:''}</p><p>A not-received order may already be prepared. Check actual progress before cooking more food.</p></details>
   {data.undated_open_count>0&&<p className="client-report-note">{data.undated_open_count} open {data.undated_open_count===1?'order has':'orders have'} no handover date and {data.undated_open_count===1?'is':'are'} excluded from daily totals. <Link to="/admin/orders?review=missing-delivery">Review missing dates</Link></p>}
   {data.count>0&&data.received_count>0&&<p>Menu totals include orders already received. Use each order’s receipt status before preparing more food.</p>}
   {data.count===0?<p>No {receipt==='all'?'non-cancelled':receipt==='received'?'received':'not-received'} orders for this date.</p>:<><MenuTable rows={data.menus} truncated={data.menus_truncated}/><h3>Orders &amp; print slips</h3><div className="client-report-orders">{data.orders.map(order=><article key={order.id}><div><h4>Order #ORD-{String(order.id).padStart(5,'0')}</h4><p>{order.name}</p><p>{order.delivery_method==='pickup'?'Self-collection':'Delivery'} · {arrivalLabel(order)}</p><p>{order.receipt_status==='received'?'Received':'Not received'} · Payment: {order.payment_status}</p></div><div><strong>{reportMoney(order.total)}</strong><a className="admin-action-link" href={slipUrl(order.id)} target="_blank" rel="noopener noreferrer"><Printer size={16} aria-hidden="true"/>Preview &amp; print<span className="sr-only"> order #{order.id} in a new tab</span></a><Link className="admin-action-link" to={`/admin/orders?order=${order.id}`}>Manage order<ArrowRight size={15} aria-hidden="true"/></Link></div></article>)}</div><div className="client-report-pages"><button type="button" disabled={page===1||report.loading} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(data.count/50))} · {data.count} orders</span><button type="button" disabled={!data.has_more||report.loading} onClick={()=>setPage(value=>value+1)}>Next</button></div></>}
  </>}
 </section>;
}

export function PeriodSalesReport() {
 const [start, setStart] = useState(()=>malaysiaDay().slice(0,8)+'01'), [end, setEnd] = useState(malaysiaDay);
 const [range, setRange] = useState({start, end});
 const validate = useCallback(data=>periodReport(data, range.start, range.end),[range]);
 const query = `start=${range.start}&end=${range.end}`;
 const report = useClientReport(`/api/admin/reports/period-sales/?${query}`,validate);
 const data = report.data;
 return <section id="period-sales" className="client-report" aria-labelledby="period-sales-title">
  <header><div><h2 id="period-sales-title">Sales by delivery date</h2><p>Paid orders marked received, using the agreed Malaysia delivery or collection date. Generated history and test payments are excluded.</p></div></header>
  <form onSubmit={event=>{event.preventDefault();if(range.start===start&&range.end===end)report.refresh();else setRange({start,end});}}><label>From<input type="date" required value={start} max={end||undefined} onChange={event=>setStart(event.target.value)}/></label><label>To<input type="date" required value={end} min={start||undefined} onChange={event=>setEnd(event.target.value)}/></label><button type="submit" disabled={report.loading}>View sales</button></form>
  <ReportState report={report}/>
  {data&&<><p className="client-report-period">{data.start} to {data.end} · Malaysia time</p><div className="client-report-stats">{[['Paid & received orders',data.paid_received_orders],['Net food sales',reportMoney(data.net_food_sales)],['Delivery income',reportMoney(data.delivery_income)],['Total sales',reportMoney(data.total_sales)]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p>Food sales are after {reportMoney(data.discounts)} in discounts. Delivery income is shown separately. These totals are not profit or a bank reconciliation.</p>
   {(data.unpaid_received_orders>0||data.unscheduled_orders>0||data.excluded_test_orders>0)&&<p className="client-report-note">{data.unpaid_received_orders} received orders in this range are unpaid. {data.excluded_test_orders} paid test orders excluded. {data.unscheduled_orders} paid, received orders have no handover date and are excluded from every dated report.</p>}
   {data.paid_received_orders===0?<p>No paid, received sales in this date range.</p>:<><div className="client-report-scroll" tabIndex={0} role="region" aria-label="Sales by day"><table><caption>Days with recorded sales</caption><thead><tr><th scope="col">Date</th><th scope="col">Net food</th><th scope="col">Delivery</th><th scope="col">Total</th></tr></thead><tbody>{data.days.map(row=><tr key={row.date}><th scope="row">{row.date}</th><td>{reportMoney(row.net_food_sales)}</td><td>{reportMoney(row.delivery_income)}</td><td>{reportMoney(row.total_sales)}</td></tr>)}</tbody></table></div><MenuTable rows={data.menus} truncated={data.menus_truncated} sales/><p>Menu totals use accepted prices before order discounts. They do not add up to net food sales when discounts apply.</p></>}
   {!data.menus_truncated&&<a className="client-report-export" href={`/api/admin/reports/period-sales/export/?${query}`}>Download sales CSV</a>}
  </>}
 </section>;
}
