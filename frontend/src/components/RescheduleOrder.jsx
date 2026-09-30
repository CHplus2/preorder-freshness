import {useState} from 'react';
import axios from 'axios';
import {apiError} from '../utils/apiError';
import {getCookie} from '../utils/cookieUtils';

const when = value => new Date(value).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'});

export default function RescheduleOrder({order, onSaved}) {
  const [open, setOpen] = useState(false);
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
    try { setPolicy((await axios.get(url)).data); }
    catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  async function submit(event, confirm = false) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const body = confirm ? {confirm:preview.confirm} : {delivery_at:`${delivery}:00+08:00`, reason};
      const response = await axios.post(url, body, {headers:{'X-CSRFToken':getCookie('csrftoken')}});
      if (confirm) {
        setPreview(null);
        setMessage('Delivery time updated. Your order total and accepted menu remain unchanged.');
        await onSaved();
        setPolicy((await axios.get(url)).data);
      } else setPreview(response.data);
    } catch (e) {
      setError(apiError(e));
      // Keep the confirmation after network failures so retries remain idempotent.
      if (e.response) setPreview(null);
    } finally { setBusy(false); }
  }

  return <section className="dk-panel">
    <button type="button" aria-expanded={open} disabled={busy} onClick={() => {
      setOpen(!open); if (!open) {setPreview(null); load();}
    }}>Delivery changes and history</button>
    {open && <div>
      <p>Online changes are available while the order is pending, more than 24 hours before preparation starts. New times must meet the same cutoff and kitchen availability. All times are Malaysia time.</p>
      {busy && <p role="status">Checking…</p>}
      {error && <p role="alert">{error} {!policy && <button type="button" disabled={busy} onClick={load}>Try again</button>}</p>}
      {message && <p role="status">{message}</p>}
      {policy && !policy.eligible && <p>{policy.reason}</p>}
      {policy?.eligible && <form className="fyp-form" onSubmit={submit}>
        <p>Changes for this booking close at {when(policy.cutoff)}. Your address, portions, recipe and price stay the same.</p>
        <label>New delivery date and time (Malaysia)
          <input type="datetime-local" required value={delivery} disabled={busy} onChange={e=>{setDelivery(e.target.value);setPreview(null);setMessage('');}}/>
        </label>
        <label>Reason for changing the time
          <textarea required maxLength={300} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);setPreview(null);setMessage('');}}/>
        </label>
        <button disabled={busy}>Preview available time</button>
        {preview && <div>
          <p>Change delivery from <strong>{when(preview.preview.previous_delivery)}</strong> to <strong>{when(preview.preview.delivery_at)}</strong>?</p>
          <p>Reason: {preview.preview.reason}</p>
          <p>Further online changes would close at {when(preview.preview.change_closes_at)}. This preview holds no capacity and expires after 10 minutes; availability is checked again when you confirm.</p>
          <button type="button" disabled={busy} onClick={e=>submit(e,true)}>Confirm delivery change</button>
          <button type="button" disabled={busy} onClick={()=>setPreview(null)}>Keep current delivery</button>
        </div>}
      </form>}
      {policy && <div><h3>Recent delivery changes</h3>
        {policy.history.length ? <ol>{policy.history.map(change=><li key={change.id}>
          <p>{when(change.previous_delivery)} → {when(change.delivery_at)}</p>
          <p>{change.reason} · Changed by {change.by} on {when(change.at)}</p>
        </li>)}</ol> : <p>No delivery changes recorded.</p>}
      </div>}
    </div>}
  </section>;
}
