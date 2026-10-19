import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import './ManualPlan.css';
import {shiftPreparation} from '../utils/preparationShift';
const inputTime=value=>value?new Date(Date.parse(value)+8*3600000).toISOString().slice(0,16):'';
const hasPassed=value=>value<=Date.now();
const when=value=>new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'});
export default function ManualPlan({order,onSaved}){
 const tasks=order.preparation_plan?.tasks || [];
 const detailed=tasks.length>0 && order.preparation_plan?.mode!=='manual_window';
 const [individual,setIndividual]=useState(false);
 const [shiftStart,setShiftStart]=useState('');
 const shifted=shiftPreparation(tasks,shiftStart);
 const [mode,setMode]=useState(detailed?'steps':'window');
 const [stepStarts,setStepStarts]=useState(()=>tasks.map(t=>inputTime(t.start)));
 const [start,setStart]=useState(()=>inputTime(order.preparation_at));
 const [end,setEnd]=useState(()=>inputTime(order.preparation_end_at));
 const [reason,setReason]=useState(''),[preview,setPreview]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const [history,setHistory]=useState(null),[historyError,setHistoryError]=useState(''),[historyBusy,setHistoryBusy]=useState(false);
 async function loadHistory(){
  setHistoryBusy(true);setHistoryError('');
  try{const r=await axios.get(`/api/admin/orders/${order.id}/manual-plan/`,{timeout:30000});if(!Array.isArray(r.data?.history))throw new Error('Invalid history response');setHistory(r.data.history);}
  catch(e){setHistoryError(apiError(e));}finally{setHistoryBusy(false);}
 }
 async function submit(event,confirm=false){
  event.preventDefault();if(busy)return;
  if(!confirm && mode==='steps' && !individual && !shifted){setError('Choose a new preparation start. The end time will be calculated from the saved steps.');return;}
  if(!confirm){
   const first=mode==='steps'?(individual?Math.min(...stepStarts.map(v=>Date.parse(v+':00+08:00'))):Date.parse(shifted.start)):Date.parse(start+':00+08:00');
   const last=mode==='steps'?(individual?Math.max(...stepStarts.map((v,i)=>Date.parse(v+':00+08:00')+Date.parse(tasks[i].end)-Date.parse(tasks[i].start))):Date.parse(shifted.end)):Date.parse(end+':00+08:00');
   if(!Number.isFinite(first) || !Number.isFinite(last)){setError('Enter a complete date and time for preparation. All times are Malaysia time.');return;}
   if(hasPassed(first)){setError('Preparation must start in the future. Use Calculate new plan above if this saved start has already passed.');return;}
   if(last<=first){setError('Preparation must finish after it starts.');return;}
   if(last>=Date.parse(order.delivery_at)){setError('This arrangement finishes at or after delivery. Choose an earlier start or agree a later delivery; time for delivery is also required.');return;}
  }
  setBusy(true);setError('');
  try{
   const response=await axios.post(`/api/admin/orders/${order.id}/manual-plan/`,confirm?{confirm:preview.confirm}:{mode,reason,...(mode==='steps'?{steps:individual?stepStarts.map((value,index)=>({index,start:value+':00+08:00'})):shifted.steps}:{start:start+':00+08:00',end:end+':00+08:00'})},{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(confirm){
    if(response.data?.order?.id!==order.id)throw new Error('The save response could not be verified. Refresh Planner before retrying.');
    setPreview(null);setSaved(true);onSaved();
   }else{
    if(typeof response.data?.confirm!=='string' || !Array.isArray(response.data?.preview?.warnings))throw new Error('The preview could not be read. Please retry.');
    setPreview(response.data);
   }
  }catch(e){setError(apiError(e));if(e.response?.status<500)setPreview(null);}
  finally{setBusy(false);}
 }
 return <details className="manual-plan">
  <summary>Manual arrangement · advanced</summary>
  <p>Use automatic planning above first. A manual arrangement is for a plan you have checked yourself; conflicts and handling limits still need review.</p>
  <p>All times are Malaysia time. Delivery and payment stay unchanged, and previous plans stay in change history.</p>
  {saved?<p role="status">Preparation times saved and kitchen confirmation recorded.</p>:<form className="fyp-form" onSubmit={submit}>
   {detailed && <label>Editing mode<select disabled={busy} value={mode} onChange={e=>{setMode(e.target.value);setPreview(null)}}><option value="steps">Move existing preparation steps</option><option value="window">Reserve a whole-kitchen window</option></select></label>}
   {mode==='steps'?<><label>New preparation start<input type="datetime-local" required={!individual} disabled={busy || individual} value={shiftStart} onChange={e=>{setShiftStart(e.target.value);setPreview(null);setError('')}}/></label>{!individual && shifted && <p className="manual-calculated-end" role="status">Calculated finish: <strong>{when(shifted.end)}</strong>. Saved step lengths, gaps and overlaps stay unchanged; kitchen availability is checked when you review.</p>}<label className="manual-individual-toggle"><input type="checkbox" checked={individual} disabled={busy} onChange={e=>{setIndividual(e.target.checked);setPreview(null);setError('')}}/> Adjust individual step starts instead</label>{individual && <div className="manual-step-list">{tasks.map((task,index)=><fieldset key={index} disabled={busy}><legend>{task.menu}: {task.name}{task.batch_number?` (batch ${task.batch_number})`:''}</legend><p>{Math.round((Date.parse(task.end)-Date.parse(task.start))/60000)} minutes · {task.resource.replaceAll('_',' ')} · {task.worker?'Hands-on':'Unattended'}</p><label>Step {index+1} starts<input type="datetime-local" required value={stepStarts[index]} onChange={e=>{setStepStarts(values=>values.map((v,i)=>i===index?e.target.value:v));setPreview(null)}}/></label>{stepStarts[index] && <p>Ends {when(new Date(Date.parse(stepStarts[index]+':00+08:00')+Date.parse(task.end)-Date.parse(task.start)).toISOString())}</p>}</fieldset>)}</div>}</>:<><p>This override replaces the step breakdown and reserves the entire kitchen, including overnight gaps. Enter both times only if you have verified the duration yourself. Use automatic planning to calculate recipe timings.</p><div className="manual-plan-fields"><label>Preparation starts<input type="datetime-local" required disabled={busy} value={start} onChange={e=>{setStart(e.target.value);setPreview(null)}}/></label><label>Preparation finishes<input type="datetime-local" required disabled={busy} value={end} onChange={e=>{setEnd(e.target.value);setPreview(null)}}/></label></div></>}
   <label>Reason / preparation arrangement<textarea rows={3} maxLength={500} required disabled={busy} value={reason} onChange={e=>{setReason(e.target.value);setPreview(null)}}/></label>
   {error && <p role="alert">{error}</p>}
   {!preview?<button disabled={busy}>{busy?'Checking…':'Review preparation times'}</button>:<section className="manual-plan-preview"><h3>Confirm preparation times</h3><p>{when(preview.preview.start)} to {when(preview.preview.end)}</p><ol>{preview.preview.task_times?.map((t,i)=><li key={i}>{t.menu}: {t.name}<br/>{when(t.start)} to {when(t.end)}</li>)}</ol><ul>{preview.preview.warnings.map(w=><li key={w}>{w}</li>)}</ul><p>Confirm only after reviewing these notes and agreeing any necessary arrangements with the customer.</p><div className="admin-toolbar"><button type="button" disabled={busy} onClick={e=>submit(e,true)}>{busy?'Saving…':'Confirm times and accept request'}</button><button type="button" disabled={busy} onClick={()=>setPreview(null)}>Back to editing</button></div></section>}
  </form>}
  <details className="manual-plan-history"><summary>Preparation change history</summary><button type="button" disabled={historyBusy} onClick={loadHistory}>{historyBusy?'Loading…':'Load recent changes'}</button>{historyError && <p role="alert">{historyError}</p>}{history?.length===0 && <p>No changes recorded.</p>}{history?.map(row=><article key={row.id}><p>{when(row.at)} · Owner #{row.actor}</p><p>{row.after?.plan?.reason || 'Plan or order amendment'}</p><details><summary>Previous preparation steps</summary>{row.before?.plan?.tasks?.length?<ul>{row.before.plan.tasks.map((t,i)=><li key={i}>{t.name}: {when(t.start)} to {when(t.end)}</li>)}</ul>:<p>No previous task breakdown.</p>}</details></article>)}</details>
 </details>;
}
