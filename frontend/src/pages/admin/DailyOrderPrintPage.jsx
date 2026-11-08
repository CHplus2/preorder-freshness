import {useCallback} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import useClientReport from '../../hooks/useClientReport';
import {dailyPrintableSlips,malaysiaDay} from '../../utils/clientReports';
import {OrderSlip} from './OrderPrintPage';
import './OrderPrintPage.css';
export function DailySlips({data}){
 return data.count===0?<p>No orders match this date and receipt filter.</p>:<div className="daily-order-slips">{data.orders.map((order,index)=><OrderSlip key={order.id} order={order} position={index+1} total={data.count}/>)}</div>;
}
export default function DailyOrderPrintPage(){
 const [params]=useSearchParams();const day=params.get('date')||malaysiaDay(),receipt=params.get('receipt')||'all';
 const validate=useCallback(data=>dailyPrintableSlips(data,day,receipt),[day,receipt]);
 const query=new URLSearchParams({date:day,receipt});
 const report=useClientReport(`/api/admin/reports/daily-orders/slips/?${query}`,validate);
 return <main className="order-slip-page daily-slips-page"><div className="order-slip-tools"><Link to={`/admin/orders?view=daily&${query}`}>Back to daily summary</Link><button type="button" disabled={!report.data?.count||report.loading||!!report.error} onClick={()=>window.print()}>Print all orders or save PDF</button><button type="button" disabled={report.loading} onClick={report.refresh}>Refresh print set</button><p>{day} · {receipt==='all'?'All non-cancelled orders':receipt==='received'?'Received orders':'Not received orders'} · Malaysia time. {report.data&&!report.loading&&!report.error?`${report.data.count} orders ready to print. `:''}Refresh after changing an order. Keep printed customer details private.</p></div>
  {report.loading?<p role="status">Loading every matching order for printing…</p>:report.error?<div role="alert"><p>{report.error}</p><p>No partial print set is available. Refresh the print set to try again.</p></div>:report.data&&<DailySlips data={report.data}/>}
 </main>;
}
