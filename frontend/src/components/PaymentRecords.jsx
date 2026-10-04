import {useUI} from '../contexts/UIContext';
import {invalidResponse} from '../utils/apiResponse';
import {useEffect, useRef, useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';

export default function PaymentRecords({order, onSaved}) {
  const {setAlert}=useUI();
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [kind,setKind]=useState('receipt'),[outcome,setOutcome]=useState('completed');
  const [reference,setReference]=useState(''),[note,setNote]=useState(''),[revision,setRevision]=useState(0);
  const retry=useRef(null);
  useEffect(()=>{const c=new AbortController();
    axios.get(`/api/admin/orders/${order.id}/payments/`,{signal:c.signal}).then(r=>{if(!r.data || !Array.isArray(r.data.events) || !['unpaid','paid','refunded'].includes(r.data.payment_status))throw invalidResponse();setData(r.data);setOutcome('completed');setKind(r.data.payment_status==='unpaid'?'receipt':'refund')}).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))});
    return()=>c.abort();},[order.id,revision]);
  const save=async e=>{e.preventDefault();if(busy || !data)return;setBusy(true);setError('');
    const body={kind,outcome:kind==='receipt'?'completed':outcome,reference,note,resolves:data.unresolved_refund};
    const key=JSON.stringify(body);
    try{if(retry.current?.key!==key)retry.current={key,id:crypto.randomUUID()};
    const result=await axios.post(`/api/admin/orders/${order.id}/payments/`,{...body,request_id:retry.current.id},{headers:{'X-CSRFToken':getCookie('csrftoken')}});
      if(!Number.isInteger(result.data?.id))throw invalidResponse();
      setAlert({type:'success',message:'Payment record saved.'});
      retry.current=null;setReference('');setNote('');setData(null);setError('');setRevision(n=>n+1);Promise.resolve().then(()=>onSaved()).catch(()=>setAlert({type:'error',message:'Payment record was saved, but the order view could not refresh. Reload records before making another change.'}));
    }catch(e){const message=apiError(e);setError(message);setAlert({type:'error',message});}finally{setBusy(false)}
  };
  return <section className="dk-panel"><h3>Payment records · order #{order.id}</h3>
    {error && <p role="alert">{error} <button type="button" onClick={()=>{setData(null);setError('');setRevision(n=>n+1)}}>Reload records</button></p>}
    {!data?(!error && <p role="status">Loading payment records…</p>):<>
      <p>{data.policy}</p><p>Current status: <strong>{data.payment_status}</strong> · Full amount: RM {data.amount}</p>
      <ol>{data.events.map(e=><li key={e.id}><strong>{e.kind} · {e.outcome} · RM {e.amount}</strong><br/>{e.reference} · {e.method} · {new Date(e.created_at).toLocaleString('en-MY')}<br/>{e.source==='legacy_unverified'?'Imported status: original payment evidence and date unverified.':`Recorded by account #${e.actor ?? 'unavailable'}`}{e.note && <p>{e.note}</p>}</li>)}</ol>
      {data.payment_status!=='refunded' && <form className="fyp-form" onSubmit={save}>
        <label>Action<select value={kind} onChange={e=>setKind(e.target.value)}>
          {data.payment_status==='unpaid'?<option value="receipt">Confirm full payment received</option>:<option value="refund">Record full refund</option>}
        </select></label>
        {kind==='refund' && <label>Refund outcome<select value={outcome} onChange={e=>setOutcome(e.target.value)}>
          <option value="completed">Completed {order.payment_method==='wallet'?'— return demo credits now':'— funds already returned externally'}</option>
          {!data.unresolved_refund && <option value="pending">Pending — no funds recorded as returned</option>}
          <option value="failed">Failed — no funds returned</option>
        </select></label>}
        {data.unresolved_refund && <p>Resolve pending refund #{data.unresolved_refund} before starting another.</p>}
        <label>Verification / transaction reference<input required maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></label>
        <label>Notes<textarea maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label>
        <button disabled={busy}>{busy?'Recording…':'Record verified outcome'}</button>
      </form>}
    </>}
  </section>;
}
