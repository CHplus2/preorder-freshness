import {useEffect,useState} from 'react';
import axios from 'axios';
import {apiError} from '../utils/apiError';
import {recommendationCsv} from '../utils/recommendationExport';
import './RecommendationReport.css';
const stages=[['clicked_sessions','Clicked a suggestion'],['added_sessions','Added to basket'],['ordered_sessions','Placed an attributed order'],['paid_sessions','Attributed paid order']];
export default function RecommendationReport(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{const controller=new AbortController();axios.get('/api/admin/recommendation-metrics/',{signal:controller.signal}).then(r=>setData(r.data)).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[revision]);
  const refresh=()=>{setLoading(true);setError('');setRevision(n=>n+1)};
  const download=()=>{
    try{
      const url=URL.createObjectURL(new Blob([recommendationCsv(data)],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');
      link.href=url;link.download=`recommendation-engagement-${data.generated_at.slice(0,10)}.csv`;
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{setError('The export could not be created. Refresh the report and try again.');}
  };
  return <section className="dk-panel recommendation-report" aria-label="Recommendation engagement"><div className="recommendation-report-heading"><h2>Recommendation engagement</h2><button type="button" disabled={loading} onClick={refresh}>{loading?'Loading…':'Refresh recommendations'}</button></div>
    <p>Rolling last {data?.days ?? 28} days, based on when suggestions were requested. This window is separate from the contribution report’s date filter.</p>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading recommendation activity…</p>}
    {!loading && !error && data && <>
      <div className="recommendation-export"><button type="button" onClick={download} disabled={!data.generated_at}>Download engagement CSV</button><p>Exports these displayed figures, with the reporting window and interpretation notes. No customer details are included.{data.generated_at && <> Report generated {new Date(data.generated_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})} (Malaysia).</>}</p></div>

      {data.rows.length===0?<p>No displayed suggestions have been recorded in this window. Activity will appear after customers use “Find my options”.</p>:<div className="recommendation-variants">{data.rows.map(row=><article key={row.variant}><h3>{row.variant==='personalised'?'Personalised suggestions':'Popularity baseline'}</h3><p><strong>{row.exposed_sessions}</strong> recommendation requests with displayed results</p><dl>{stages.map(([key,label])=>{const count=row[key];const percent=Number.isFinite(count) && row.exposed_sessions>0?100*count/row.exposed_sessions:null;return <div key={key}><dt>{label}</dt><dd>{percent===null?'Unavailable':`${count} · ${percent.toFixed(1)}%`}</dd></div>})}</dl></article>)}</div>}
      <p>Percentages are per recommendation request, not per customer.</p>
      <details><summary>How these figures are calculated</summary><p>{data.experiment_enabled?'Random assignment is currently enabled for popularity and personalised suggestions.':'Observational mode is currently enabled; results do not establish improvement over a baseline.'} The current setting may differ from earlier requests in this window.</p><p>{data.definition}</p><p>A repeat visitor can count more than once. These measures are not a sequential funnel; some events may be missing.</p><p>Unpaid cash-on-delivery orders do not count as paid yet. Recent requests may still convert, and payment updates can change these figures later. These figures describe recorded activity; they do not establish that suggestions caused additional sales.</p></details>
    </>}
  </section>;
}
