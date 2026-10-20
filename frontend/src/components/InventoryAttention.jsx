import {inventoryAttention} from '../utils/inventoryAttention';
import {useState} from 'react';
import './InventoryAttention.css';
const labels={held:'On hold',expired:'Past recorded expiry',today:'Recorded expiry today',soon:'Expiry in 1–3 days',unknown:'Missing expiry date'};
const advice={held:'Review the hold and handling records before deciding what to do.',expired:'Review and record disposal where appropriate; these batches are excluded from stock allocation.',today:'Review today’s requirements against the batch records.',soon:'Review upcoming preparation needs before buying more of this ingredient.',unknown:'Complete the date records before relying on shelf-life estimates.'};
const money=value=>new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(value);
export default function InventoryAttention({items,today,onReview}) {
  const [expanded,setExpanded]=useState({});
  const groups=inventoryAttention(items,today).filter(g=>g.rows.length);
  return <section className="inventory-attention" aria-label="Batches needing attention"><h2>Stock needing attention</h2>
    <p>As of {today} · Malaysia time · non-empty batches only. Held batches appear only under On hold.</p>
    <p className="inventory-attention-note">Batch references identify deliveries of an ingredient, not menu IDs. Demo stock keeps its original scenario dates; expiry dates do not roll forward automatically.</p>
    {!groups.length?<p>No held, overdue or soon-expiring stock recorded.</p>:groups.map(group=><details key={group.key} open={['held','expired','today'].includes(group.key)}><summary>{labels[group.key]} · {group.rows.length} batches</summary>
      <p>{advice[group.key]}</p><p>Recorded stock value: <strong>{money(group.value)}</strong>{group.unknownCosts>0 && ` · ${group.unknownCosts} batches have no cost recorded; total is incomplete.`}</p>
      <ul>{(expanded[group.key]?group.rows:group.rows.slice(0,6)).map(row=><li key={row.id}><div><strong>{row.raw_material_name}</strong><span className="inventory-batch-reference">Batch #{row.id}{row.batch_code?` · Reference: ${row.batch_code}`:''}</span><span>{row.quantity} {row.unit} · expiry {row.expiry_date || 'not recorded'}{row.storage_location?` · ${row.storage_location}`:''}</span></div><button type="button" onClick={()=>onReview(row.id)} aria-label={`Review batch ${row.batch_code || row.id}`}>Review batch</button></li>)}</ul>
      {group.rows.length>6 && <div className="inventory-attention-more"><p>Showing {expanded[group.key]?group.rows.length:6} of {group.rows.length} batches. Value above includes all {group.rows.length}.</p><button type="button" aria-expanded={!!expanded[group.key]} onClick={()=>setExpanded({...expanded,[group.key]:!expanded[group.key]})}>{expanded[group.key]?'Show fewer batches':`Show all ${group.rows.length} batches`}</button></div>}
    </details>)}
    <p className="inventory-attention-note">Dates reflect recorded shelf life, not a safety assessment. Values use remaining quantity × recorded unit cost; they are not confirmed waste or savings.</p>
  </section>;
}
