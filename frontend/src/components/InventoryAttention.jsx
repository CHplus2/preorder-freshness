import {inventoryAttention} from '../utils/inventoryAttention';
import './InventoryAttention.css';
const labels={held:'On hold',expired:'Past recorded expiry',today:'Recorded expiry today',soon:'Expiry in 1–3 days',unknown:'Missing expiry date'};
const advice={held:'Review the hold and handling records before deciding what to do.',expired:'Review and record disposal where appropriate; these batches are excluded from stock allocation.',today:'Review today’s requirements against the batch records.',soon:'Review upcoming preparation needs before buying more of this ingredient.',unknown:'Complete the date records before relying on shelf-life estimates.'};
const money=value=>new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(value);
export default function InventoryAttention({items,today,onReview}) {
  const groups=inventoryAttention(items,today).filter(g=>g.rows.length);
  return <section className="inventory-attention" aria-label="Batches needing attention"><h2>Stock needing attention</h2>
    <p>As of {today} · Malaysia time · non-empty batches only. Held batches appear only under On hold.</p>
    {!groups.length?<p>No held, overdue or soon-expiring stock recorded.</p>:groups.map(group=><details key={group.key} open={['held','expired','today'].includes(group.key)}><summary>{labels[group.key]} · {group.rows.length} batches</summary>
      <p>{advice[group.key]}</p><p>Recorded stock value: <strong>{money(group.value)}</strong>{group.unknownCosts>0 && ` · ${group.unknownCosts} batches have no cost recorded; total is incomplete.`}</p>
      <ul>{group.rows.map(row=><li key={row.id}><div><strong>{row.raw_material_name} · {row.batch_code || `Batch #${row.id}`}</strong><span>{row.quantity} {row.unit} · expiry {row.expiry_date || 'not recorded'}{row.storage_location?` · ${row.storage_location}`:''}</span></div><button type="button" onClick={()=>onReview(row.id)} aria-label={`Review batch ${row.batch_code || row.id}`}>Review batch</button></li>)}</ul>
    </details>)}
    <p className="inventory-attention-note">Dates reflect recorded shelf life, not a safety assessment. Values use remaining quantity × recorded unit cost; they are not confirmed waste or savings.</p>
  </section>;
}
