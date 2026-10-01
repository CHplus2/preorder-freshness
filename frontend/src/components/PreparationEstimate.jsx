import {useId,useState} from 'react';
import {useStorefront} from '../contexts/StorefrontProvider';
import {preparationEstimate} from '../utils/preparationEstimate';
import {duration} from '../utils/planner';
import './PreparationEstimate.css';

export default function PreparationEstimate({menu}) {
  const [quantity,setQuantity]=useState('10');
  const id=useId();
  const storefront=useStorefront();
  const estimate=preparationEstimate(menu,quantity,storefront?.error?{}:storefront?.store);
  return <section className="preparation-estimate" aria-label="Preparation time preview">
    <h3>Try a sample order</h3><p>Check the timing from your current edits before saving. This preview does not create an order or reserve a slot.</p>
    <label htmlFor={id}>Sample portions<input id={id} inputMode="numeric" type="text" value={quantity} maxLength={5} onChange={e=>setQuantity(e.target.value)}/></label>
    {estimate.error?<p role="status">{estimate.error}</p>:<>
      <dl><div><dt>Batches</dt><dd>{estimate.batches} at {estimate.size} portions per batch{estimate.partial>0?` (last batch: ${estimate.partial})`:''}</dd></div><div><dt>Total step time</dt><dd>{duration(estimate.total)}</dd></div><div><dt>Hands-on time</dt><dd>{duration(estimate.handsOn)}</dd></div></dl>
      <p>{estimate.independent?'Every batch repeats the full recipe; extra-batch minutes are ignored.':'Each step combines the first-batch duration and the extra-batch time.'} {estimate.dailyMinutes===null?'Kitchen hours are unavailable; daily-window checks are omitted.':`Kitchen work window: ${duration(estimate.dailyMinutes)} per day, before closures and bookings.`}</p>
      <ul className="estimate-steps">{estimate.steps.map((t,i)=><li key={i}><strong>{t.name}</strong><span>{duration(t.uninterrupted)} uninterrupted{t.repetitions>1?` × ${t.repetitions} batches`:''} · {t.worker?'Hands-on':'Unattended'}</span></li>)}</ul>
      {estimate.warnings.length>0 && <div className="estimate-warnings"><strong>Review these settings</strong><ul>{estimate.warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
      <p className="estimate-note">Total step time is not the elapsed preparation window. Equipment overlap, working hours, waiting limits, advance notice and existing bookings affect the actual schedule. Only the availability check evaluates a delivery time.</p>
    </>}
  </section>;
}
