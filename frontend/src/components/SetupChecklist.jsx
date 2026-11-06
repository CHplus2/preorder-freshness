import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import axios from 'axios';
import {ArrowRight,CheckCircle2,Circle} from 'lucide-react';
import {apiError} from '../utils/apiError';
import {revealSettingsTarget} from '../utils/settingsWorkspace';

function SetupAction({href,children}){
  const content=<>{children}<ArrowRight size={16} aria-hidden="true"/></>;
  if(!href.startsWith('/admin/settings#'))return <Link className="admin-action-link" to={href}>{content}</Link>;
  return <a className="admin-action-link" href={href} onClick={event=>{
    if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    const id=href.split('#')[1];if(revealSettingsTarget(id)){event.preventDefault();window.history.replaceState(null,'','#'+id);}
  }}>{content}</a>;
}

export default function SetupChecklist({embedded=false}) {
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
  return <section className="setup-checklist dk-panel" id={embedded?undefined:'setup'} aria-labelledby="setup-heading">
    <h2 id="setup-heading" className={embedded?'sr-only':undefined}>Set up your kitchen</h2>
    <div className="setup-checklist-heading"><p>Check the saved details used for new orders.</p>
    <button type="button" disabled={loading} onClick={()=>{setLoading(true);setError('');setRefresh(n=>n+1);}}>{loading?'Checking setup…':'Refresh checks'}</button></div>
    {error && <p role="alert">{error} Use Refresh checks to try again.</p>}
    {loading && <p role="status">Reading saved settings and menus…</p>}
    {!loading && !error && data && <>
      <p className="setup-progress-label"><strong>{data.completed} of {data.total} setup steps complete</strong><span>{data.menu_count} active {data.menu_count === 1 ? 'menu' : 'menus'}</span></p>
      <progress value={data.completed} max={data.total} aria-label="Completed kitchen setup steps"/>
      {data.checkout&&<section className="setup-checkout-status" aria-label="Saved checkout settings"><h3>Checkout settings</h3><div className="setup-checkout-grid"><article><h4>QR payment</h4><p>{({ready:'Enabled with a receiving image.',missing_image:'No receiving image saved.',disabled:'Switched off.'})[data.checkout.qr_status]||'Refresh to check.'}</p><SetupAction href="/admin/settings#qr-payments">Set up receiving QR</SetupAction></article><article><h4>Delivery areas</h4><p>{data.checkout.delivery_area_count?`${data.checkout.delivery_area_count} areas saved.`:'Any area at the default fee.'}</p><SetupAction href="/admin/settings#shop-delivery-fee">Edit areas and fees</SetupAction></article></div>{data.checkout.bank_transfer_ready&&<p className="setup-caption">Bank transfer is enabled for delivery. Collection requires QR payment.</p>}</section>}
      <ol className="setup-steps">{data.steps.map(step=><li key={step.id}>
        <div className="setup-step-heading">{step.complete?<CheckCircle2 size={19} aria-hidden="true"/>:<Circle size={19} aria-hidden="true"/>}<h3>{step.title}</h3><span className="setup-step-status">{step.complete?'Complete':'Needs attention'}</span></div>
        <p>{step.detail}</p>
        {step.affected_count > 0 && <details className="setup-affected"><summary>{step.affected_count} {step.affected_count===1?'menu needs':'menus need'} attention</summary><p>{step.examples.map(p=>p.name).join(', ')}{step.affected_count>step.examples.length?' (first 10 shown)':''}.</p></details>}
        <SetupAction href={step.href}>{step.action}</SetupAction>
      </li>)}</ol>
      <section className="setup-inventory" aria-labelledby="setup-inventory-title"><h3 id="setup-inventory-title">Inventory follow-up</h3>
      <dl className="setup-inventory-counts">{[['Received batches',data.inventory.received_batches],['Within dates · not held',data.inventory.usable_by_recorded_date],['Past recorded date',data.inventory.expired_batches],['On hold',data.inventory.held_batches]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="setup-caption">{data.inventory.usable_batches_missing_cost>0?`${data.inventory.usable_batches_missing_cost} available ${data.inventory.usable_batches_missing_cost===1?'batch needs a purchase cost':'batches need purchase costs'} for complete contribution reporting.`:'Purchase costs are recorded for all available batches.'} Held and expired counts can overlap.</p>
      <SetupAction href="/admin/inventory">Review inventory records</SetupAction></section>
      <details className="setup-explanation"><summary>About these checks</summary><p>{data.note}</p><p>Menu checks cover menus accepting new orders. Paused and archived menus remain in your records. Refresh after editing menus or inventory.</p></details>
      <p className="setup-caption setup-checked">Last checked {new Date(data.checked_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})} · Malaysia</p>
    </>}
  </section>;
}
