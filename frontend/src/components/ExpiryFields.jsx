import {useId} from 'react';
import {changeExpiryBasis,expiryPreview} from '../utils/expiryEvidence';
import {malaysiaDate} from '../utils/planner';
import {applyStorageGuidance,matchingStorageGuidance,storageNames} from '../utils/storageGuidance';
import './ExpiryFields.css';

function Field({id,label,children}){return <div className="expiry-field"><label htmlFor={id}>{label}</label>{children}</div>;}
export default function ExpiryFields({value,onChange,disabled=false,material=null}){
 const prefix=useId(),id=key=>prefix+'-'+key,set=(key,next)=>onChange({...value,[key]:next});
 const basis=value.expiry_basis || 'label',today=malaysiaDate(new Date()),preview=expiryPreview(value,today);
 const forcedHold=['unknown','breach'].includes(value.handling_history);
 const needsSource=basis!=='label' || !!value.opened_date || !!value.thawed_date;
 const printed=value.original_expiry_date || (basis==='label'?value.expiry_date:'') || '';
 const saved=matchingStorageGuidance(value,material);
 const setPrinted=next=>onChange({...value,original_expiry_date:next || null,...(basis==='label'?{expiry_date:next}:{})});
 return <div className="expiry-evidence-panel"><fieldset className="expiry-evidence" disabled={disabled}><legend>Batch dates and shelf-life evidence</legend>
  <p>Received date records when this batch reached you. A printed expiry is the supplier’s deadline. For unlabelled food, use documented storage guidance that matches the ingredient and its actual conditions.</p>
  <div className="expiry-fields-grid">
   <Field id={id('source')} label="Purchase source"><select id={id('source')} value={value.source_type || 'other'} onChange={e=>set('source_type',e.target.value)}><option value="other">Other / not recorded</option><option value="packaged">Packaged supermarket / supplier</option><option value="market">Wet market / unpackaged</option></select></Field>
   <Field id={id('supplier')} label="Supplier / shop (optional)"><input id={id('supplier')} maxLength={160} value={value.supplier || ''} onChange={e=>set('supplier',e.target.value)}/></Field>
   <Field id={id('basis')} label="Expiry calculation"><select id={id('basis')} value={basis} onChange={e=>onChange(changeExpiryBasis(value,e.target.value))}><option value="label">Printed expiry / best-before date</option><option value="manufactured">Manufacture date + documented shelf life</option><option value="storage">Received date + documented storage life</option></select></Field>
   <Field id={id('storage')} label="Actual storage"><select id={id('storage')} value={value.storage_type || 'chilled'} onChange={e=>set('storage_type',e.target.value)}><option value="chilled">Chilled</option><option value="frozen">Frozen</option><option value="ambient">Ambient</option></select></Field>
  </div>
  {material && <div className="expiry-saved-guidance">
   <strong>Saved guidance · {storageNames[value.storage_type || 'chilled']}</strong>
   {saved?<><p>{saved.shelf_life_days} days from receipt. {saved.conditions}</p><p>Source: {saved.source}</p>
    <button type="button" onClick={()=>onChange(applyStorageGuidance(value,material))}>Use this guidance for this batch</button>
    <p>Copies the days and evidence into received-date mode, replacing this form’s calculation and source. Check that the conditions match. Earlier printed, opened or thawed limits still apply; holds stay in place.</p>
   </>:<p>No saved guidance for this storage type. Enter custom documented days below, use a printed date, or save a reference in the ingredient directory.</p>}
  </div>}
  {basis==='label'?<>
   <Field id={id('printed')} label="Printed expiry / best-before date"><input id={id('printed')} required type="date" value={printed} onChange={e=>setPrinted(e.target.value)}/></Field>
   <Field id={id('label-type')} label="Printed date meaning"><select id={id('label-type')} value={value.label_date_type || 'not_recorded'} onChange={e=>set('label_date_type',e.target.value)}><option value="not_recorded">Not recorded</option><option value="use_by">Use by / expiry</option><option value="best_before">Best before (quality date)</option></select></Field>
   <p>Enter the date printed on the package, not its manufacturing or purchase date. A best-before date is a quality reference; the system still treats the recorded deadline as a stock-allocation limit.</p>
  </>:<>
   {basis==='manufactured' && <Field id={id('manufactured')} label="Manufacture date"><input id={id('manufactured')} required max={value.received_date || today} type="date" value={value.manufactured_date || ''} onChange={e=>set('manufactured_date',e.target.value || null)}/></Field>}
   <Field id={id('days')} label={basis==='storage'?'Documented storage life from receipt (days)':'Documented shelf life from manufacture (days)'}><input id={id('days')} required type="number" step="1" min="1" value={value.shelf_life_days ?? ''} onChange={e=>set('shelf_life_days',e.target.value===''?null:Number(e.target.value))}/></Field>
   {basis==='storage' && <p>No manufacturing date is needed for this mode. Receipt does not reset the ingredient’s age or prove its earlier handling. Document the storage conditions; hold the batch if its handling is uncertain.</p>}
  </>}
  <Field id={id('guidance')} label={`Guidance source and required storage conditions${needsSource?' (required)':' (optional for a printed date)'}`}><textarea id={id('guidance')} required={needsSource} rows={3} maxLength={300} value={value.guidance_note || ''} onChange={e=>set('guidance_note',e.target.value)} placeholder="Source/document reference and the matching ingredient, temperature and handling conditions"/></Field>
  <p className="expiry-guidance-link"><a href="https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts" target="_blank" rel="noopener noreferrer">FoodSafety.gov cold food storage chart</a> · General reference. Read the conditions and whether a limit concerns safety or quality before using it; this link does not fill or verify a batch’s dates.</p>
  <div className="expiry-preview" role="status">{preview?<><strong>Planning deadline: {preview.effective}</strong><p>{basis==='label'?`Printed deadline: ${preview.base}.`:`${basis==='storage'?'Received':'Manufactured'} ${basis==='storage'?value.received_date:value.manufactured_date} + ${value.shelf_life_days} days = ${preview.base}.`} The earliest recorded deadline wins, including printed, opened and thawed limits.</p></>:<p>Complete the received date and the relevant expiry fields to preview the planning deadline.</p>}<p>Preview only; saving validates the records. Dates do not measure physical freshness or confirm food safety.</p></div>
  <details className="expiry-handling"><summary>Earlier limits and handling history{basis!=='label' && value.original_expiry_date?' · printed limit recorded':''}</summary>
   {basis!=='label' && <><Field id={id('printed-cap')} label="Also have a printed expiry? (optional)"><input id={id('printed-cap')} type="date" value={value.original_expiry_date || ''} onChange={e=>setPrinted(e.target.value)}/></Field><p>Leave blank for an unlabelled batch. A recorded printed date also limits calculated shelf life; switching modes never extends it.</p></>}
   <div className="expiry-fields-grid">{[['opened_date','after_open_days','Opened on','Documented days after opening'],['thawed_date','after_thaw_days','Thawing completed on','Documented days after thawing']].map(([field,days,label,dayLabel])=><div key={field}>
    <Field id={id(field)} label={label}><input id={id(field)} type="date" min={value.received_date || undefined} max={today} value={value[field] || ''} onChange={e=>onChange({...value,[field]:e.target.value || null,...(!e.target.value?{[days]:null}:{})})}/></Field>
    <Field id={id(days)} label={dayLabel}><input id={id(days)} type="number" step="1" min="1" value={value[days] ?? ''} onChange={e=>set(days,e.target.value===''?null:Number(e.target.value))}/></Field>
   </div>)}</div>
   <Field id={id('history')} label="Handling history"><select id={id('history')} value={value.handling_history || 'not_recorded'} onChange={e=>onChange({...value,handling_history:e.target.value,...(['unknown','breach'].includes(e.target.value)?{quarantined:true}:{})})}><option value="not_recorded">Not recorded</option><option value="documented">Documented</option><option value="unknown">Uncertain handling — hold batch</option><option value="breach">Known storage breach — hold batch</option></select></Field>
   <Field id={id('observations')} label="Storage evidence and observations"><textarea id={id('observations')} required={value.handling_history==='documented'} rows={3} maxLength={500} value={value.handling_note || ''} onChange={e=>set('handling_note',e.target.value)} placeholder="Known supplier packing time, transport/storage temperatures and refrigeration or freezing interruptions"/></Field>
   <p>Opening and thawing need both a date and documented duration. These are calendar-day planning limits; hourly limits need owner review. Uncertain handling or a known storage breach holds the batch.</p>
  </details>
  <Field id={id('cost')} label="Batch purchase cost per inventory unit (RM, optional)"><input id={id('cost')} type="number" min="0" step="0.000001" value={value.unit_cost ?? ''} onChange={e=>set('unit_cost',e.target.value===''?null:e.target.value)}/></Field>
  <p>Match the ingredient unit: RM12/kg = RM0.012/g. Leave unknown costs blank.</p>
  <label className="expiry-hold"><input type="checkbox" disabled={forcedHold} checked={forcedHold || !!value.quarantined} onChange={e=>set('quarantined',e.target.checked)}/><span>Hold batch — exclude from cooking stock</span></label>
  {forcedHold && <p>Handling needs review. Record the reviewed handling history before releasing this hold.</p>}
 </fieldset></div>;
}
