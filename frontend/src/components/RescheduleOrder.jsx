import ArrivalWindowChoice from './ArrivalWindowChoice';
import {arrivalLabel,arrivalMinutes,makeArrivalWindow} from '../utils/arrivalWindow';
import {isPickup} from '../utils/fulfilment';
import {useId, useState} from 'react';
import axios from 'axios';
import {apiError} from '../utils/apiError';
import {getCookie} from '../utils/cookieUtils';
import {deliveryPolicy, deliveryPreview, deliveryConfirmation} from '../utils/deliveryResponse';
import {unconfirmedDeliveryRequest} from '../utils/orderProgress';
import {useUI} from '../contexts/UIContext';
import {useAuth} from '../contexts/AuthContext';

const when = value => value ? new Date(value).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'}) : 'Not recorded';

export default function RescheduleOrder({order, onSaved, historyOnly=false}) {
  const {setAlert} = useUI();
  const {isAdmin} = useAuth() || {};
  const pickup=isPickup(order);
  const firstDate = Boolean(isAdmin && !order.delivery_at);
  const [open, setOpen] = useState(null);
  const panelId = useId();
  const [policy, setPolicy] = useState(null);
  const [windowMinutes,setWindowMinutes]=useState(()=>arrivalMinutes(order));
  const [delivery, setDelivery] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const url = `/api/orders/${order.id}/reschedule/`;

  async function load() {
    setBusy(true); setError(''); setPolicy(null);
    try { setPolicy(deliveryPolicy((await axios.get(url,{timeout:30000})).data)); }
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
      const body = confirm ? {confirm:preview.confirm} : {delivery_at:`${delivery}:00+08:00`, reason, arrival_window_minutes:windowMinutes};
      const response = await axios.post(url, body, {timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
      if (confirm) {
        const saved = deliveryConfirmation(response.data, order.id).order;
        const awaitingKitchen = saved.preparation_plan?.needs_review === true;
        setPreview(null);
        setPolicy(null);
        setDelivery(''); setReason('');
        setMessage(awaitingKitchen
          ? 'Requested time saved. The kitchen still needs to confirm preparation; no preparation slots are reserved. Your order total and accepted menu remain unchanged.'
          : 'Delivery time updated. Your order total and accepted menu remain unchanged.');
        setAlert({message:awaitingKitchen?'Request updated · awaiting kitchen confirmation.':'Delivery time updated.',type:'success'});
        // The mutation is confirmed. A later read failure must not imply it failed.
        try {
          await onSaved?.();
          setPolicy(deliveryPolicy((await axios.get(url,{timeout:30000})).data));
        } catch {
          setError('Your delivery change was saved, but the latest details could not be loaded. Try again to refresh them.');
        }
      } else setPreview(deliveryPreview(response.data));
    } catch (e) {
      setError(apiError(e));
      // Keep the confirmation after network failures so retries remain idempotent.
      if (e.response && e.response.status < 500) setPreview(null);
    } finally { setBusy(false); }
  }

  const toggle = mode => {
    setOpen(open === mode ? null : mode);
    setPreview(null); setError('');
    if (open !== mode) load();
  };
  return <section className="delivery-change">
    <div className="delivery-change-actions">
      {!historyOnly && order.status === 'pending' && order.payment_status !== 'refunded' && <button type="button" aria-expanded={open === 'change'} aria-controls={panelId} disabled={busy} onClick={()=>toggle('change')}>{firstDate?'Set delivery date':unconfirmedDeliveryRequest(order)?'Change requested time':pickup?'Change collection time':'Change delivery time'}</button>}
      <button type="button" className="delivery-history-toggle" aria-expanded={open === 'history'} aria-controls={panelId} disabled={busy} onClick={()=>toggle('history')}>{pickup?'Collection history':'Delivery history'}</button>
    </div>
    {open && <div id={panelId} className="delivery-change-panel">
      <div className="delivery-change-heading"><h3>{open === 'change' ? firstDate?'Set the first delivery date':pickup?'Choose a new collection time':'Choose a new delivery time' : pickup?'Collection history':'Delivery history'}</h3><button type="button" disabled={busy} onClick={()=>setOpen(null)}>Close</button></div>
      {busy && <p role="status">Checking…</p>}
      {error && <p role="alert">{error} {!policy && <button type="button" disabled={busy} onClick={load}>Try again</button>}</p>}
      {message && <p className="delivery-change-success" role="status">{message}</p>}
      {open === 'change' && policy && !policy.eligible && <p>{policy.reason}</p>}
      {open === 'change' && policy?.eligible && <form className="fyp-form" noValidate onSubmit={submit}>
        <p className="delivery-change-hint">{policy.initial_delivery ? 'Record an agreed future delivery request. This does not mark the order paid or delivered, or reserve preparation time.' : policy.unconfirmed_request ? 'This request has no reserved preparation time. You can propose another future delivery time.' : <>Change by <strong>{when(policy.cutoff)}</strong>.</>} All times are Malaysia time.</p>
        {!preview ? <>
          {!pickup && <ArrivalWindowChoice value={windowMinutes} onChange={setWindowMinutes} disabled={busy}/>}
          <label>{windowMinutes?'New window ends':'New date and time'}
            <input type="datetime-local" required value={delivery} disabled={busy} onChange={e=>{setDelivery(e.target.value);setMessage('');}}/>
          </label>
          {windowMinutes>0 && delivery && <p>New arrival window: {arrivalLabel({delivery_at:delivery+':00+08:00',arrival_window:makeArrivalWindow(delivery+':00+08:00',windowMinutes)})}</p>}
          <label>{policy.initial_delivery?'Delivery arrangement / reason':'Reason for the change'}
            <textarea rows={2} required maxLength={300} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);setMessage('');}}/>
          </label>
          <details className="delivery-change-rules"><summary>How delivery changes work</summary><p>{policy.initial_delivery?'Choose an agreed date within 90 days, more than 24 hours away and after the menu lead time. Delivery restrictions and menu capacity are checked. Preparation still needs owner confirmation.':policy.unconfirmed_request?'You can change an unconfirmed request while no preparation is reserved. If the new time cannot be scheduled, it still needs kitchen confirmation.':'Changes close 24 hours before preparation starts. The new time must meet this cutoff and kitchen availability.'} Your items, address and price stay the same.</p></details>
          <div className="delivery-change-actions"><button disabled={busy}>Check new time</button><button type="button" disabled={busy} onClick={()=>setOpen(null)}>Cancel</button></div>
        </> : <DeliveryChangePreview preview={preview.preview} busy={busy} onConfirm={e=>submit(e,true)} onBack={()=>setPreview(null)}/>}
      </form>}
      {open === 'history' && policy && <div>
        {policy.history.length ? <ol className="delivery-change-history">{policy.history.map(change=><li key={change.id}>
          <strong>{arrivalLabel({delivery_at:change.delivery_at,arrival_window:change.arrival_window})}</strong><p>Previously {arrivalLabel({delivery_at:change.previous_delivery,arrival_window:change.previous_window})}</p>
          <p>{change.reason}</p><small>Changed by {change.by} · {when(change.at)}</small>
        </li>)}</ol> : <p>No delivery changes recorded.</p>}
      </div>}
    </div>}
  </section>;
}

export function DeliveryChangePreview({preview,busy,onConfirm,onBack}) {
  const awaitingKitchen=preview.needs_review===true;
  return <div className="delivery-change-review">
    <h4>{awaitingKitchen?'Review your requested time':'Confirm your new delivery time'}</h4>
    <dl><div><dt>{awaitingKitchen?'Current requested delivery':'Current delivery'}</dt><dd>{arrivalLabel({delivery_at:preview.previous_delivery,arrival_window:preview.previous_window})}</dd></div><div><dt>{awaitingKitchen?'New requested delivery':'New delivery'}</dt><dd><strong>{arrivalLabel(preview)}</strong></dd></div></dl>
    <p>Reason: {preview.reason}</p>
    {awaitingKitchen && <p>This saves your delivery request. The kitchen must still confirm a workable preparation plan; no preparation slots are reserved.</p>}
    <p className="delivery-change-hint">This preview expires in 10 minutes. The time and kitchen availability are checked again when saved.</p>
    {!awaitingKitchen && preview.change_closes_at && <details className="delivery-change-rules"><summary>Deadline for any further changes</summary><p>{when(preview.change_closes_at)}. This preview does not reserve kitchen capacity.</p></details>}
    <div className="delivery-change-actions"><button type="button" disabled={busy} onClick={onConfirm}>{awaitingKitchen?'Save requested time':'Confirm new time'}</button><button type="button" disabled={busy} onClick={onBack}>Back</button></div>
  </div>;
}
