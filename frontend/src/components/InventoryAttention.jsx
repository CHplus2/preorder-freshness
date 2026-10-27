import {inventoryAttention} from '../utils/inventoryAttention';
import {useState} from 'react';
import './InventoryAttention.css';
const labels={held:'On hold',expired:'Past recorded date',today:'Deadline today',soon:'Deadline in 1–3 days',unknown:'Dates to review'};
const advice={held:'Review the hold and handling records before deciding what to do. Held batches are excluded from allocation.',expired:'Review and record disposal where appropriate. These batches are excluded from stock allocation.',today:'Check today’s preparation needs against the batch records.',soon:'Check upcoming preparation needs before buying more of this ingredient.',unknown:'Complete the date records before relying on shelf-life estimates.'};
const money=value=>new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(value);
export default function InventoryAttention({items,today,onReview,disabled=false}) {
 const [chosen,setChosen]=useState(''),[expanded,setExpanded]=useState(false);
 const groups=inventoryAttention(items,today).filter(g=>g.rows.length);
 const active=groups.find(g=>g.key===chosen) || groups[0];
 return <section className="inventory-attention" aria-label="Batches needing attention"><header><div><h2>Stock needing attention</h2><p>{today} · Malaysia time · batches with stock remaining</p></div></header>
  {!active?<p>No held, overdue or soon-expiring stock recorded.</p>:<>
   <div className="inventory-priority-tabs" role="group" aria-label="Stock attention priorities">{groups.map(group=><button type="button" key={group.key} aria-pressed={active.key===group.key} onClick={()=>{setChosen(group.key);setExpanded(false)}}>{labels[group.key]} <strong>{group.rows.length}</strong></button>)}</div>
   <section className="inventory-priority-panel" aria-label={labels[active.key]}><p>{advice[active.key]}</p><p className="inventory-recorded-value">Recorded stock value: <strong>{money(active.value)}</strong>{active.unknownCosts>0 && ` · ${active.unknownCosts} ${active.unknownCosts===1?'batch has':'batches have'} no cost; total is incomplete.`}</p>
    <ul>{(expanded?active.rows:active.rows.slice(0,3)).map(row=><li key={row.id}><div><strong>{row.raw_material_name}</strong><span>{row.quantity} {row.unit} · deadline {row.expiry_date || 'not recorded'}</span><span className="inventory-batch-reference">Batch #{row.id}{row.batch_code?` · ${row.batch_code}`:''}{row.storage_location?` · ${row.storage_location}`:''}</span></div><button type="button" disabled={disabled} onClick={()=>onReview(row.id)} aria-label={`Review batch ${row.batch_code || row.id}`}>Review batch</button></li>)}</ul>
    {active.rows.length>3 && <div className="inventory-attention-more"><p>Showing {expanded?active.rows.length:3} of {active.rows.length}. Value includes all batches in this group.</p><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Show fewer batches':`Show all ${active.rows.length} batches`}</button></div>}
   </section>
  </>}
  <p className="inventory-attention-note">Each batch appears in one priority group; held stock is listed under On hold. Dates are recorded shelf life, not a safety assessment. Stock value is not confirmed waste.</p>
 </section>;
}
