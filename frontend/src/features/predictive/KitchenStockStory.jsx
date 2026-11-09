import {stockStory, stockQuantity, kitchenCase} from './kitchenPresentation';
import {ZeroWasteNotice} from './FreshCastChrome';

export function EvidenceNotes({risk}) {
  const supplied = Array.isArray(risk.review_reasons) ? risk.review_reasons : [];
  const notes = [...new Set(supplied.filter(note=>typeof note==='string').map(note=>note.trim()).filter(Boolean))];
  if(!notes.length && typeof risk.alert_reason==='string' && risk.alert_reason.trim())notes.push(risk.alert_reason.trim());
  if(!notes.length)return null;
  return <details className="local-evidence-notes"><summary>Review details</summary><ul>{notes.map(note => <li key={note}>{note}</li>)}</ul></details>;
}

export default function KitchenStockStory({risk, window, compact = false}) {
  const story = stockStory(risk);
  const issue = kitchenCase(risk);
  const amount = value => stockQuantity(value, risk.unit);
  const nativeAmount = value => value==null || !Number.isFinite(value) ? 'Unavailable' : `${new Intl.NumberFormat('en-MY',{maximumFractionDigits:3}).format(value)} ${risk.unit}`;
  const unusedByDate = {};
  for(const batch of risk.stock_flow?.batches || []){
    if(batch.expires_in_window && batch.projected_remaining>0 && batch.expiry_date)unusedByDate[batch.expiry_date]=(unusedByDate[batch.expiry_date] || 0)+batch.projected_remaining;
  }
  const datedOutcomes = [
    ...Object.entries(unusedByDate).map(([date,quantity])=>({date,quantity,label:'Left at expiry'})),
    ...(risk.stock_flow?.demand_by_day || []).filter(day=>day.forecast_requirement-day.forecast_consumed>0.001)
      .map(day=>({date:day.date,quantity:day.forecast_requirement-day.forecast_consumed,label:'Forecast shortfall'})),
  ].sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label));
  if (!story) return <p>Refresh kitchen data to see the expiry stock breakdown.</p>;
  if (compact) return <section className={`local-stock-story ${issue.kind}`} aria-label="Forecast and expiry stock summary">
    <div className="local-demand-equation compact">
      <article><span>Forecast need</span><strong>{amount(story.need)}</strong><small>Additional demand after order adjustments</small></article>
      <article><span>Available after bookings</span><strong>{amount(risk.stock_flow.after_confirmed)}</strong><small>{amount(story.nearAvailable)} expires in this window</small></article>
      <article className="gap"><span>{risk.shortfall_quantity>0 ? 'Confirmed-order gap' : story.gap > 0 ? 'Forecast stock gap' : 'Expected unused at expiry'}</span><strong>{amount(risk.shortfall_quantity>0 ? risk.shortfall_quantity : story.gap > 0 ? story.gap : story.waste)}</strong><small>{risk.shortfall_quantity>0 ? 'Known bookings need more stock' : story.gap > 0 ? 'Estimated demand, not a confirmed purchase' : 'Unused remainder of expiring batches'}</small></article>
    </div>
    {story.gap > 0 && <p>Expected unused at expiry: <strong>{amount(story.waste)}</strong>.</p>}
    <ZeroWasteNotice waste={story.waste} carried={story.carried} unit={risk.unit}/>
    {risk.shortfall_quantity > 0 && story.gap>0 && <p>Additional forecast gap: <strong>{amount(story.gap)}</strong> · separate from the confirmed-order gap above.</p>}
  </section>;
  return <section className={`local-stock-story ${issue.kind}`} aria-label="Forecast and expiry stock summary">
    {!compact && <><h3>Where the forecast need comes from</h3><p>{window.start_date}–{window.end_date} · {window.horizon_days} days · stock reserved for included bookings is already removed below.</p></>}
    {risk.confirmed_requirement>0 && <p>Confirmed bookings need <strong>{amount(risk.confirmed_requirement)}</strong>. Assigned stock: {amount(risk.stock_flow.confirmed_allocated)}; confirmed gap: <strong>{amount(risk.shortfall_quantity)}</strong>.</p>}
    <div className="local-stock-pools">
      <article className="near"><span>Use first · expiring in this window</span><strong>{amount(story.nearAvailable)}</strong><small>{story.firstExpiry ? `Earliest expiry ${story.firstExpiry}` : 'No eligible batches expire in this window'}</small></article>
      <article className="later"><span>Then use · later-expiring stock</span><strong>{amount(story.laterAvailable)}</strong><small>Usable only on eligible demand dates</small></article>
    </div>
    <div className="local-demand-equation" aria-label="Forecast need minus dated stock coverage">
      {[
        ['Forecast need', story.need, 'Additional demand after order adjustments', 'need'],
        ['From expiring stock', story.nearUsed, 'Forecast use before each batch expires', 'near'],
        ['From later stock', story.laterUsed, 'Forecast use from later-expiring batches', 'later'],
        ['Forecast stock gap', story.gap, 'Review this estimate before purchasing', 'gap'],
      ].map(([label, value, hint, name]) => <article key={name} className={name}><span>{label}</span><strong>{amount(value)}</strong>{!compact && <small>{hint}</small>}</article>)}
    </div>
    {!compact && <p className="pd-note">Summary amounts are rounded. The stock breakdown retains native ingredient units.</p>}
    <dl className="local-stock-outcomes" aria-label="Stock outcome explanation">
      <div><dt>Expected unused at expiry</dt><dd><strong>{amount(story.waste)}</strong><p>{amount(story.nearAvailable)} in expiring batches, with {amount(story.nearUsed)} forecast to be used before their deadlines.</p></dd></div>
      <div><dt>Forecast shortfall</dt><dd><strong>{amount(story.gap)}</strong><p>Forecast demand is {amount(story.need)}. Stock usable on the required dates covers {amount(risk.stock_flow.forecast_consumed)}.</p></dd></div>
    </dl>
    <details className="local-stock-calculations" aria-label={`Stock calculations in ${risk.unit}`}><summary>See calculation</summary>
      <p><span>Unused at expiry</span><strong>{nativeAmount(story.nearAvailable)} − {nativeAmount(story.nearUsed)} = {nativeAmount(story.waste)}</strong></p>
      <p><span>Forecast shortfall</span><strong>{nativeAmount(story.need)} − {nativeAmount(story.nearUsed)} − {nativeAmount(story.laterUsed)} = {nativeAmount(story.gap)}</strong></p>
    </details>
    {story.waste>0 && story.gap>0 && <p className="local-stock-timing-note">Stock can expire unused and still be short on another date. Stock must be received and unexpired on the day it is needed.</p>}
    {datedOutcomes.length>0 && <div className="pd-table-wrap local-stock-dates" tabIndex={0} role="region" aria-label="Expiry and unmet demand dates"><table>
      <caption>Forecast amounts by date</caption><thead><tr><th>Date</th><th>Outcome</th><th>Amount</th></tr></thead>
      <tbody>{datedOutcomes.map(row=><tr key={`${row.date}-${row.label}`}><td>{row.date}</td><td>{row.label}</td><td>{nativeAmount(row.quantity)}</td></tr>)}</tbody>
    </table></div>}
    <ZeroWasteNotice waste={story.waste} carried={story.carried} unit={risk.unit}/>
    {risk.shortfall_quantity > 0 && <p><strong>Confirmed-order gap: {amount(risk.shortfall_quantity)}.</strong> This is separate from the additional forecast gap above.</p>}
  </section>;
}
