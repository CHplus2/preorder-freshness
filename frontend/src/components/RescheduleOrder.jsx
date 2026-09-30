import {useId, useState} from 'react';
import axios from 'axios';
import {apiError} from '../utils/apiError';
import {getCookie} from '../utils/cookieUtils';

const when = value => new Date(value).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'});

export default function RescheduleOrder({order, onSaved}) {
  const [open, setOpen] = useState(null);
  const panelId = useId();
  const [policy, setPolicy] = useState(null);
  const [delivery, setDelivery] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const url = `/api/orders/${order.id}/reschedule/`;

  async function load() {
    setBusy(true); setError('');
    try { setPolicy((await axios.get(url,{timeout:30000})).data); }
    catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  async function submit(event, confirm = false) {
    event.preventDefault();
    if (busy) return;
    if (!confirm && (!delivery || !reason.trim())) {
      setError(!delivery ? 'Choose a complete delivery date and time.' : 'Enter a reason for the delivery change.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const body = confirm ? {confirm:preview.confirm} : {delivery_at:`${delivery}:00+08:00`, reason};
      const response = await axios.post(url, body, {timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
      if (confirm) {
        setPreview(null);
        setMessage('Delivery time updated. Your order total and accepted menu remain unchanged.');
        await onSaved();
        setPolicy((await axios.get(url,{timeout:30000})).data);
      } else setPreview(response.data);
    } catch (e) {
      setError(apiError(e));
      // Keep the confirmation after network failures so retries remain idempotent.
      if (e.response) setPreview(null);
    } finally { setBusy(false); }
  }

  const toggle = mode => {
    setOpen(open === mode ? null : mode);
    setPreview(null); setError('');
    if (open !== mode) load();
  };
  return <section className="delivery-change">
    <div className="delivery-change-actions">
      {order.status === 'pending' && order.payment_status !== 'refunded' && <button type="button" aria-expanded={open === 'change'} aria-controls={panelId} disabled={busy} onClick={()=>toggle('change')}>Change delivery time</button>}
      <button type="button" className="delivery-history-toggle" aria-expanded={open === 'history'} aria-controls={panelId} disabled={busy} onClick={()=>toggle('history')}>Delivery history</button>
    </div>
    {open && <div id={panelId} className="delivery-change-panel">
      <div className="delivery-change-heading"><h3>{open === 'change' ? 'Choose a new delivery time' : 'Delivery history'}</h3><button type="button" disabled={busy} onClick={()=>setOpen(null)}>Close</button></div>
      {busy && <p role="status">Checking…</p>}
      {error && <p role="alert">{error} {!policy && <button type="button" disabled={busy} onClick={load}>Try again</button>}</p>}
      {message && <p className="delivery-change-success" role="status">{message}</p>}
      {open === 'change' && policy && !policy.eligible && <p>{policy.reason}</p>}
      {open === 'change' && policy?.eligible && <form className="fyp-form" noValidate onSubmit={submit}>
        <p className="delivery-change-hint">Change by <strong>{when(policy.cutoff)}</strong>. All times are Malaysia time.</p>
        {!preview ? <>
          <label>New date and time
            <input type="datetime-local" required value={delivery} disabled={busy} onChange={e=>{setDelivery(e.target.value);setMessage('');}}/>
          </label>
          <label>Reason for the change
            <textarea rows={2} required maxLength={300} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);setMessage('');}}/>
          </label>
          <details className="delivery-change-rules"><summary>How delivery changes work</summary><p>Changes close 24 hours before preparation starts. The new time must meet this cutoff and kitchen availability. Your items, address and price stay the same.</p></details>
          <div className="delivery-change-actions"><button disabled={busy}>Check new time</button><button type="button" disabled={busy} onClick={()=>setOpen(null)}>Cancel</button></div>
        </> : <div className="delivery-change-review">
          <h4>Confirm your new time</h4>
          <dl><div><dt>Current delivery</dt><dd>{when(preview.preview.previous_delivery)}</dd></div><div><dt>New delivery</dt><dd><strong>{when(preview.preview.delivery_at)}</strong></dd></div></dl>
          <p>Reason: {preview.preview.reason}</p>
          <p className="delivery-change-hint">Confirm within 10 minutes. Availability is checked again when you confirm.</p>
          <details className="delivery-change-rules"><summary>Deadline for any further changes</summary><p>{when(preview.preview.change_closes_at)}. This preview does not reserve kitchen capacity.</p></details>
          <div className="delivery-change-actions"><button type="button" disabled={busy} onClick={e=>submit(e,true)}>Confirm new time</button><button type="button" disabled={busy} onClick={()=>setPreview(null)}>Back</button></div>
        </div>}
      </form>}
      {open === 'history' && policy && <div>
        {policy.history.length ? <ol className="delivery-change-history">{policy.history.map(change=><li key={change.id}>
          <strong>{when(change.delivery_at)}</strong><p>Previously {when(change.previous_delivery)}</p>
          <p>{change.reason}</p><small>Changed by {change.by} · {when(change.at)}</small>
        </li>)}</ol> : <p>No delivery changes recorded.</p>}
      </div>}
    </div>}
  </section>;
}
