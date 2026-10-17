import {useEffect,useState} from 'react';
import axios from 'axios';
import {contributionReport} from '../utils/costResponse';
import {readApiError} from '../utils/apiError';
import {ContributionSummary,OrderContribution} from './ContributionEvidence';
const date=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
export default function OutcomePanel(){
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
  const [range,setRange]=useState(()=>({start:date(Date.now()-27*86400000),end:date(Date.now())}));
  const [applied,setApplied]=useState(range),[report,setReport]=useState(null),[error,setError]=useState('');
  const download=async()=>{
    if(exporting || !report)return;
    setExporting(true);setExportError('');
    try{
      const result=await axios.get('/api/admin/contribution/export/',{params:{start:report.start,end:report.end},responseType:'blob'});
      const url=URL.createObjectURL(result.data),link=document.createElement('a');
      link.href=url;link.download=`food-contribution-${report.start}-to-${report.end}.csv`;
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){
      if(e.response?.data instanceof Blob){try{e.response.data=JSON.parse(await e.response.data.text());}catch{e.response.data=null;}}
      setExportError(readApiError(e));
    }finally{setExporting(false);}
  };
  useEffect(()=>{const c=new AbortController();
    axios.get('/api/admin/contribution/',{params:applied,signal:c.signal})
      .then(a=>setReport(contributionReport(a.data))).catch(e=>{if(!axios.isCancel(e))setError(readApiError(e))});return()=>c.abort();},[applied]);
  return <section className="dk-panel"><h2>Order contribution</h2>
    <p>Recorded food revenue minus recorded batch ingredient costs and accepted packaging estimates. This is an order outcome, not a current-recipe estimate or net profit.</p>
    <form className="fyp-form inline" onSubmit={e=>{e.preventDefault();setReport(null);setError('');setExportError('');setApplied({...range})}}>
      <label>Orders placed from<input type="date" required value={range.start} onChange={e=>setRange({...range,start:e.target.value})}/></label>
      <label>Through<input type="date" required min={range.start} value={range.end} onChange={e=>setRange({...range,end:e.target.value})}/></label><button>Apply / refresh</button>
    </form>{error && <p role="alert">{error}</p>}
    {!report && !error && <p role="status">Loading outcomes…</p>}
    {report && <><ContributionSummary report={report}/><details className="contribution-help"><summary>How contribution is calculated</summary><p>{report.definition}</p><p>Generated forecast history may have paid/delivered flags without any actual cooking or batch consumption. It can support a forecast scenario while historical contribution remains unavailable. Updating current ingredient estimates does not backfill those records.</p></details>
      <button type="button" disabled={exporting} onClick={download}>{exporting?'Preparing export…':'Download contribution CSV'}</button>
      <p>Exports all orders placed from {report.start} through {report.end}, up to 5,000 orders. Larger ranges must be narrowed. Export values reflect records at download time; blank contribution means unavailable. No customer contact details are included.</p>
      {exportError && <p role="alert">{exportError}</p>}
      {report.rows.map(row=><OrderContribution key={row.order} row={row}/>)}
    </>}
  </section>;
}
