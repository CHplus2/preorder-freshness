export default function ExpiryFields({value,onChange}){
 const set=(key,v)=>onChange({...value,[key]:v});
 return <fieldset><legend>Shelf-life evidence and storage</legend>
 <p>Use documented supplier or published limits for this ingredient and its actual storage. A manufacture date alone cannot establish expiry.</p>
 <label>Purchase source<select value={value.source_type || 'other'} onChange={e=>set('source_type',e.target.value)}><option value="other">Other / not recorded</option><option value="packaged">Packaged supermarket / supplier</option><option value="market">Wet market / unpackaged</option></select></label>
 <label>Supplier / shop<input maxLength={160} value={value.supplier || ''} onChange={e=>set('supplier',e.target.value)}/></label>
 <label>Calculation basis<select value={value.expiry_basis || 'label'} onChange={e=>set('expiry_basis',e.target.value)}><option value="label">Printed date</option><option value="manufactured">Manufacture date + documented shelf life</option><option value="storage">Receipt date + documented storage life</option></select></label>
 <label>Storage<select value={value.storage_type || 'chilled'} onChange={e=>set('storage_type',e.target.value)}><option value="chilled">Chilled</option><option value="frozen">Frozen</option><option value="ambient">Ambient</option></select></label>
 {value.expiry_basis==='manufactured' && <label>Manufacture date<input type="date" value={value.manufactured_date || ''} onChange={e=>set('manufactured_date',e.target.value || null)}/></label>}
 {value.expiry_basis && value.expiry_basis!=='label' && <label>Documented shelf life (days)<input type="number" min="1" value={value.shelf_life_days ?? ''} onChange={e=>set('shelf_life_days',e.target.value===''?null:Number(e.target.value))}/></label>}
 <label>Guidance source and required storage conditions<input maxLength={300} value={value.guidance_note || ''} onChange={e=>set('guidance_note',e.target.value)} placeholder="Supplier label or published source, with storage conditions"/></label>
 <details><summary>Opening, thawing and handling history</summary>
 <p>The earliest deadline wins. Opening or thawing never extends the original expiry. Receipt is not the slaughter or harvest date.</p>

 <label>Label meaning<select value={value.label_date_type || 'not_recorded'} onChange={e=>set('label_date_type',e.target.value)}><option value="not_recorded">Not recorded</option><option value="use_by">Use by / expiry</option><option value="best_before">Best before (quality date)</option></select></label>
 {[['opened_date','Opened on'],['thawed_date','Thawing completed on']].map(([key,label])=><label key={key}>{label}<input type="date" value={value[key] || ''} onChange={e=>set(key,e.target.value || null)}/></label>)}
 {[['after_open_days','Documented days after opening'],['after_thaw_days','Documented days after thawing']].map(([key,label])=><label key={key}>{label}<input type="number" min="1" value={value[key] ?? ''} onChange={e=>set(key,e.target.value===''?null:Number(e.target.value))}/></label>)}
 <label>Handling history<select value={value.handling_history || 'not_recorded'} onChange={e=>set('handling_history',e.target.value)}><option value="not_recorded">Not recorded</option><option value="documented">Documented</option><option value="unknown">Uncertain handling — hold batch</option><option value="breach">Known storage breach — hold batch</option></select></label>
 <label>Storage evidence and observations<textarea maxLength={500} value={value.handling_note || ''} onChange={e=>set('handling_note',e.target.value)} placeholder="Known supplier slaughter/packing time, transport and storage temperatures, refrigeration/freezing history and interruptions"/></label>
 <p>These are day-level planning limits, not food safety measurements. Hourly limits need owner review. Uncertain handling or a known storage breach automatically holds the batch.</p>
 </details>
 <label>Batch purchase cost per inventory unit (RM)<input type="number" min="0" step="0.000001" value={value.unit_cost ?? ''} onChange={e=>set('unit_cost',e.target.value===''?null:e.target.value)}/></label>
 <p>Match the ingredient unit: RM 12/kg = RM 0.012/g. Leave unknown costs blank. This values recorded wastage.</p>
 <label><input type="checkbox" checked={value.quarantined || false} onChange={e=>set('quarantined',e.target.checked)}/> Hold batch — exclude from cooking stock</label>
 <a href="https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts" target="_blank" rel="noreferrer">Published storage guidance</a>
 </fieldset>
}
