import {useEffect,useState} from 'react';
import axios from 'axios';
import {contributionReport} from '../utils/costResponse';
import {readApiError} from '../utils/apiError';
import {ContributionSummary,OrderContribution} from './ContributionEvidence';
const date=value=>new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
export default function OutcomePanel(){
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
 const [range,setRange]=useState(()=>({start:date(Date.now()-27*86400000),end:date(Date.now())}));
 const [applied,setApplied]=useState(range),[report,setReport]=useState(null),[error,setError]=useState('');
 const download=async()=>{
  if(exporting||!report)return;
  setExporting(true);setExportError('');
  try{
   const result=await axios.get('/api/admin/contribution/export/',{params:{start:report.start,end:report.end},responseType:'blob'});
   const url=URL.createObjectURL(result.data),link=document.createElement('a');
   link.href=url;link.download=`food-contribution-${report.start}-to-${report.end}.csv`;
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){
   if(error.response?.data instanceof Blob){try{error.response.data=JSON.parse(await error.response.data.text())}catch{error.response.data=null}}
   setExportError(readApiError(error));
  }finally{setExporting(false)}
 };
 useEffect(()=>{
  const controller=new AbortController();
  axios.get('/api/admin/contribution/',{params:applied,signal:controller.signal})
   .then(({data})=>{if(!controller.signal.aborted)setReport(contributionReport(data))})
   .catch(error=>{if(!controller.signal.aborted)setError(readApiError(error))});
  return()=>controller.abort();
 },[applied]);
 return <section id="order-contribution" tabIndex={-1} className="dk-panel contribution-panel"><header className="sales-panel-heading"><div><h2>Food contribution by order</h2><p>Food sales after discounts, minus recorded ingredient and packaging costs. Delivery, labour and overhead are excluded; this is not net profit.</p></div></header>
  <form className="sales-date-filter" onSubmit={event=>{event.preventDefault();setReport(null);setError('');setExportError('');setApplied({...range})}}>
   <label>Orders placed from<input type="date" required value={range.start} max={range.end} onChange={event=>setRange({...range,start:event.target.value})}/></label>
   <label>To<input type="date" required min={range.start} value={range.end} onChange={event=>setRange({...range,end:event.target.value})}/></label><button>View orders</button>
  </form>
  {error&&<p role="alert">{error}</p>}{!report&&!error&&<p role="status">Loading order costs…</p>}
  {report&&<><ContributionSummary report={report}/>
   <div className="contribution-toolbar"><button type="button" disabled={exporting} onClick={download}>{exporting?'Preparing export…':'Download contribution CSV'}</button><details className="contribution-help"><summary>About this report & export</summary><p>{report.definition}</p><p>The page shows up to 200 orders. CSV exports include up to 5,000 matching orders with no customer contact details. Blank contribution means it cannot be calculated. Narrow the range if it is too large.</p><p>Current ingredient estimates cannot fill missing historical purchase costs. Generated forecast history can have paid/received flags without complete cost records.</p></details></div>
   {exportError&&<p role="alert">{exportError}</p>}
   <div className="contribution-order-list">{report.rows.map(row=><OrderContribution key={row.order} row={row}/>)}</div>
  </>}
 </section>;
}
