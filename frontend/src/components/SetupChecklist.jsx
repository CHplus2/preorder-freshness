import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import axios from 'axios';
import {apiError} from '../utils/apiError';

export default function SetupChecklist() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    axios.get('/api/admin/setup-checklist/', {signal:controller.signal})
      .then(r=>setData(r.data))
      .catch(e=>{if (!axios.isCancel(e)) setError(apiError(e));})
      .finally(()=>{if (!controller.signal.aborted) setLoading(false);});
    return ()=>controller.abort();
  }, [refresh]);
  return <section className="setup-checklist dk-panel" id="setup" aria-labelledby="setup-heading">
    <h2 id="setup-heading">Set up your kitchen</h2>
    <p>Work through these steps using your saved business details. Refresh after editing menus or inventory.</p>
    <button type="button" disabled={loading} onClick={()=>{setLoading(true);setError('');setRefresh(n=>n+1);}}>{loading?'Checking setup…':'Refresh checks'}</button>
    {error && <p role="alert">{error} Use Refresh checks to try again.</p>}
    {loading && <p role="status">Reading saved settings and menus…</p>}
    {!loading && !error && data && <>
      <p><strong>{data.completed} of {data.total} setup steps complete</strong> · {data.menu_count} menus</p>
      <progress value={data.completed} max={data.total} aria-label="Completed kitchen setup steps"/>
      <ol className="setup-steps">{data.steps.map(step=><li key={step.id}>
        <h3>{step.complete?'Complete':'To do'}: {step.title}</h3>
        <p>{step.detail}</p>
        {step.affected_count > 0 && <p>{step.affected_count} menus need attention: {step.examples.map(p=>p.name).join(', ')}{step.affected_count>step.examples.length?' (first 10 shown)':''}.</p>}
        {step.href.startsWith('/admin/settings#') ? <a href={step.href} onClick={event=>{
          if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
          const target=document.getElementById(step.href.split('#')[1]);
          if(target){event.preventDefault();target.scrollIntoView({block:'start'});(target.matches('input,textarea')?target:target.querySelector('input,textarea'))?.focus({preventScroll:true});}
        }}>{step.action}</a> : <Link to={step.href}>{step.action}</Link>}
      </li>)}</ol>
      <h3>Inventory follow-up</h3>
      <p>{data.inventory.received_batches} non-empty received batches; {data.inventory.usable_by_recorded_date} within their recorded dates and not held.</p>
      <p>{data.inventory.expired_batches} expired · {data.inventory.held_batches} held · {data.inventory.usable_batches_missing_cost} available batches missing purchase costs. Expired and held counts can overlap.</p>
      <Link to="/admin/inventory">Review inventory records</Link>
      <p>{data.note}</p>
      <p>Last checked: {new Date(data.checked_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})} Malaysia time.</p>
    </>}
  </section>;
}
