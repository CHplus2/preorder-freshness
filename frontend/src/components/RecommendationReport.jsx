import {useEffect,useState} from 'react';
import axios from 'axios';
import {apiError} from '../utils/apiError';
import './RecommendationReport.css';
const stages=[['clicked_sessions','Clicked a suggestion'],['added_sessions','Added to basket'],['ordered_sessions','Placed an attributed order'],['paid_sessions','Attributed paid order']];
export default function RecommendationReport(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{const controller=new AbortController();axios.get('/api/admin/recommendation-metrics/',{signal:controller.signal}).then(r=>setData(r.data)).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[revision]);
  const refresh=()=>{setLoading(true);setError('');setRevision(n=>n+1)};
  return <section className="dk-panel recommendation-report" aria-label="Recommendation engagement"><div className="recommendation-report-heading"><h2>Recommendation engagement</h2><button type="button" disabled={loading} onClick={refresh}>{loading?'Loading…':'Refresh recommendations'}</button></div>
    <p>Rolling last {data?.days ?? 28} days, based on when suggestions were requested. This window is separate from the contribution report’s date filter.</p>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading recommendation activity…</p>}
    {!loading && !error && data && <>
      <p>{data.experiment_enabled?'Random assignment is currently enabled for popularity and personalised suggestions.':'Observational mode is currently enabled; results do not establish improvement over a baseline.'} The current setting may differ from earlier requests in this window.</p>
      {data.rows.length===0?<p>No displayed suggestions have been recorded in this window. Activity will appear after customers use “Find my options”.</p>:<div className="recommendation-variants">{data.rows.map(row=><article key={row.variant}><h3>{row.variant==='personalised'?'Personalised suggestions':'Popularity baseline'}</h3><p><strong>{row.exposed_sessions}</strong> recommendation requests with displayed results</p><dl>{stages.map(([key,label])=>{const count=row[key];const percent=Number.isFinite(count) && row.exposed_sessions>0?100*count/row.exposed_sessions:null;return <div key={key}><dt>{label}</dt><dd>{percent===null?'Unavailable':`${count} · ${percent.toFixed(1)}%`}</dd></div>})}</dl></article>)}</div>}
      <p>Every percentage uses displayed recommendation requests as its denominator—not unique customers. A repeat visitor can count more than once. These measures are not necessarily a sequential funnel; some events may be missing.</p>
      <details><summary>How to interpret this for your FYP</summary><p>{data.definition}</p><p>Unpaid cash-on-delivery orders do not count as paid yet. Recent requests may still convert, and payment updates can change these figures later. Do not claim reduced decision fatigue or increased sales from these counts alone; combine them with a planned user study and report its limitations.</p></details>
    </>}
  </section>;
}
