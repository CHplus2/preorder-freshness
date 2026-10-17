import {stockStory, stockQuantity, kitchenCase} from './kitchenPresentation';
import {ZeroWasteNotice} from './FreshCastChrome';

export function EvidenceNotes({risk}) {
  const notes = risk.review_reasons?.length ? risk.review_reasons : [risk.alert_reason];
  return <details className="local-evidence-notes"><summary>Evidence to review</summary><ul>{notes.filter(Boolean).map(note => <li key={note}>{note}</li>)}</ul></details>;
}

export default function KitchenStockStory({risk, window, compact = false}) {
  const story = stockStory(risk);
  const issue = kitchenCase(risk);
  const amount = value => stockQuantity(value, risk.unit);
  if (!story) return <p>Refresh kitchen data to see the expiry stock breakdown.</p>;
  if (compact) return <section className={`local-stock-story ${issue.kind}`} aria-label="Forecast and expiry stock summary">
    <div className="local-demand-equation compact">
      <article><span>Forecast need</span><strong>{amount(story.need)}</strong><small>Additional demand after order adjustments</small></article>
      <article><span>Available after bookings</span><strong>{amount(risk.stock_flow.after_confirmed)}</strong><small>{amount(story.nearAvailable)} expires in this window</small></article>
      <article className="gap"><span>{risk.shortfall_quantity>0 ? 'Confirmed-order gap' : story.gap > 0 ? 'Forecast stock gap' : 'Expected unused at expiry'}</span><strong>{amount(risk.shortfall_quantity>0 ? risk.shortfall_quantity : story.gap > 0 ? story.gap : story.waste)}</strong><small>{risk.shortfall_quantity>0 ? 'Known bookings need more stock' : story.gap > 0 ? 'Estimated demand, not a confirmed purchase' : 'Unused remainder of expiring batches'}</small></article>
    </div>
    {story.gap > 0 && <p>Expected unused at expiry: <strong>{amount(story.waste)}</strong>.{story.waste===0?' Expiring stock is projected to be used; the remaining issue is covering demand.':''}</p>}
    <ZeroWasteNotice waste={story.waste} carried={story.carried} unit={risk.unit}/>
    {risk.shortfall_quantity > 0 && <p>Confirmed-order gap: <strong>{amount(risk.shortfall_quantity)}</strong> · separate from the forecast above.</p>}
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
        ['− From expiring stock', story.nearUsed, 'Forecast use before each batch expires', 'near'],
        ['− From later stock', story.laterUsed, 'Forecast use from later-expiring batches', 'later'],
        ['= Forecast stock gap', story.gap, 'Review this estimate before purchasing', 'gap'],
      ].map(([label, value, hint, name]) => <article key={name} className={name}><span>{label}</span><strong>{amount(value)}</strong>{!compact && <small>{hint}</small>}</article>)}
    </div>
    {!compact && <p className="local-stock-explanation">After using {amount(story.nearUsed)} of expiring stock, {amount(story.afterNear)} is still needed. Later stock covers {amount(story.laterUsed)}, leaving <strong>{amount(story.gap)} uncovered</strong>{story.firstGap ? ` from ${story.firstGap}` : ''}. Only stock usable on the demand date counts.</p>}
    <div className="local-stock-outcome"><span>Expected unused at expiry</span><strong>{amount(story.waste)}</strong><span>{story.waste > 0 ? 'Review a safe use before expiry.' : 'No unused stock is projected to expire in this window.'}</span></div>
    <ZeroWasteNotice waste={story.waste} carried={story.carried} unit={risk.unit}/>
    {risk.shortfall_quantity > 0 && <p><strong>Confirmed-order gap: {amount(risk.shortfall_quantity)}.</strong> This is separate from the additional forecast gap above.</p>}
  </section>;
}
