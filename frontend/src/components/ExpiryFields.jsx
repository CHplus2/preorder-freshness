import {useId} from 'react';
import {changeExpiryBasis,expiryBreakdown,removeIncorrectPrintedDate} from '../utils/expiryEvidence';
import {malaysiaDate} from '../utils/planner';
import {applyStorageGuidance,changeBatchStorage,matchingStorageGuidance,storageNames} from '../utils/storageGuidance';
import './ExpiryFields.css';

function Field({id,label,children}){return <div className="expiry-field"><label htmlFor={id}>{label}</label>{children}</div>;}
export default function ExpiryFields({value,onChange,disabled=false,material=null}){
 const prefix=useId(),id=key=>prefix+'-'+key,set=(key,next)=>onChange({...value,[key]:next});
 const basis=value.expiry_basis || 'label',today=malaysiaDate(new Date()),preview=expiryBreakdown(value,today);
 const forcedHold=['unknown','breach'].includes(value.handling_history);
 const needsSource=basis!=='label' || !!value.opened_date || !!value.thawed_date;
 const printed=value.original_expiry_date || (basis==='label'?value.expiry_date:'') || '';
 const saved=matchingStorageGuidance(value,material);
 const setPrinted=next=>onChange({...value,original_expiry_date:next || null,...(basis==='label'?{expiry_date:next}:{})});
 const guidance=<Field id={id('guidance')} label={`Shelf-life reference and storage conditions${needsSource?' (required)':' (optional)'}`}><textarea id={id('guidance')} required={needsSource} rows={3} maxLength={300} value={value.guidance_note || ''} onChange={e=>set('guidance_note',e.target.value)} placeholder="Document or supplier reference, ingredient condition and required temperature"/></Field>;
 const recordedLimits=!!value.opened_date || !!value.thawed_date || (basis!=='label' && !!value.original_expiry_date);
 return <div className="expiry-evidence-panel"><fieldset className="expiry-evidence" disabled={disabled}><legend>Date and storage</legend>
  <div className="expiry-fields-grid">
   <Field id={id('basis')} label="How is expiry determined?"><select id={id('basis')} value={basis} onChange={e=>onChange(changeExpiryBasis(value,e.target.value))}><option value="label">Printed expiry date</option><option value="storage">Received date + shelf life</option><option value="manufactured">Manufacture date + shelf life</option></select></Field>
   <Field id={id('storage')} label="Storage condition"><select id={id('storage')} value={value.storage_type || 'chilled'} onChange={e=>onChange(changeBatchStorage(value,e.target.value))}><option value="chilled">Chilled</option><option value="frozen">Frozen</option><option value="ambient">Ambient</option></select></Field>
  </div>
  {basis==='label'?<>
   <div className="expiry-fields-grid">
    <Field id={id('printed')} label="Printed expiry / best-before date"><input id={id('printed')} required type="date" value={printed} onChange={e=>setPrinted(e.target.value)}/></Field>
    <Field id={id('label-type')} label="Printed date meaning"><select id={id('label-type')} value={value.label_date_type || 'not_recorded'} onChange={e=>set('label_date_type',e.target.value)}><option value="not_recorded">Check the label</option><option value="use_by">Use by / expiry</option><option value="best_before">Best before (quality date)</option></select></Field>
   </div>
   <p>{value.label_date_type==='best_before'?'Best-before describes quality. The system uses it as the stock cutoff; it does not confirm when food spoils.':value.label_date_type==='use_by'?'Follow the printed date and the supplier’s storage instructions.':'Enter the expiry or best-before date on the label, not the manufacture date.'}</p>
  </>:<>
   {basis==='storage' && <>
    <p>For unlabelled ingredients, expiry is the received date plus shelf-life days from a suitable reference. Receiving food does not make it new; check its condition and earlier handling.</p>
    {saved && <div className="expiry-saved-guidance">
     <strong>Saved guidance · {storageNames[value.storage_type || 'chilled']}</strong>
     <p>{saved.shelf_life_days} days from receipt · {saved.conditions}</p><p>Source: {saved.source}</p>
      <button type="button" onClick={()=>onChange(applyStorageGuidance(value,material))}>Use saved guidance</button>
      <p>Check that these conditions match this batch. You can edit the copied values.</p>
    </div>}
   </>}
   {basis==='manufactured' && <>
    <p>Manufacture date means when the product was made. Use this method only when the shelf-life reference counts days from that date.</p>
    <Field id={id('manufactured')} label="Manufacture date"><input id={id('manufactured')} required max={value.received_date || today} type="date" value={value.manufactured_date || ''} onChange={e=>set('manufactured_date',e.target.value || null)}/></Field>
   </>}
   <Field id={id('days')} label="Shelf life (days)"><input id={id('days')} required type="number" step="1" min="1" value={value.shelf_life_days ?? ''} onChange={e=>set('shelf_life_days',e.target.value===''?null:Number(e.target.value))}/></Field>
  </>}
  {needsSource && <>{guidance}<p>Changing the storage condition clears the days and reference for review.</p></>}
  {basis!=='label' && <p className="expiry-guidance-link">Need a reference? <a href="https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts" target="_blank" rel="noopener noreferrer">FoodSafety.gov cold food storage chart</a>. Match the food, its condition and storage temperature.</p>}
  <div className={'expiry-preview'+(preview?.shortened?' expiry-preview-capped':'')} role="status">{preview?<><strong>Stock deadline: {preview.effective}</strong><p>{basis==='label'?`Printed deadline: ${preview.base}.`:`${basis==='storage'?'Received':'Manufactured'} ${basis==='storage'?value.received_date:value.manufactured_date} + ${value.shelf_life_days} days = ${preview.base}.`}</p>{preview.shortened&&<div className="expiry-controlling-limit"><p><strong>Why the saved date is earlier</strong></p><ul>{preview.controlling.map(limit=><li key={limit.kind}>{limit.label}: {limit.date}{limit.anchor?` (${limit.anchor} + ${limit.days} days)`:''}</li>)}</ul><p>This earlier record sets the deadline. Increasing shelf-life days does not remove a printed, opened or thawed limit. Review the recorded limits below.</p></div>}{preview.effective<today&&<p>Past the recorded deadline — excluded from usable stock.</p>}</>:<p>Complete the received date and the relevant expiry fields to preview the deadline.</p>}<p>Dates do not measure physical freshness or confirm food safety. Saving validates the records.</p></div>
  {basis!=='label'&&value.original_expiry_date&&<section className="expiry-recorded-cap" aria-label="Printed date also recorded"><Field id={id('visible-printed-cap')} label="Printed date also recorded for this batch"><input id={id('visible-printed-cap')} type="date" value={value.original_expiry_date} onChange={e=>setPrinted(e.target.value)}/></Field><p>This date was kept when the calculation method changed. If it was entered by mistake and this batch has no printed expiry, correct it here. Removing it does not remove opened or thawed limits.</p><button className="expiry-text-action" type="button" onClick={()=>onChange(removeIncorrectPrintedDate(value))}>Remove incorrectly recorded printed date</button></section>}
  <details className="expiry-handling"><summary>Opened, thawed or handling limits{recordedLimits?' · limits recorded':''}{forcedHold?' · hold required':''}</summary>
  {basis!=='label'&&!value.original_expiry_date && <><Field id={id('printed-cap')} label="Also have a printed expiry? (optional)"><input id={id('printed-cap')} type="date" value="" onChange={e=>setPrinted(e.target.value)}/></Field><p>Leave blank for an unlabelled batch. A recorded printed date also limits calculated shelf life.</p></>}
   <div className="expiry-fields-grid">{[['opened_date','after_open_days','Opened on','Documented days after opening'],['thawed_date','after_thaw_days','Thawing completed on','Documented days after thawing']].map(([field,days,label,dayLabel])=><div key={field}>
    <Field id={id(field)} label={label}><input id={id(field)} type="date" min={value.received_date || undefined} max={today} value={value[field] || ''} onChange={e=>onChange({...value,[field]:e.target.value || null,...(!e.target.value?{[days]:null}:{})})}/></Field>
    <Field id={id(days)} label={dayLabel}><input id={id(days)} type="number" step="1" min="1" value={value[days] ?? ''} onChange={e=>set(days,e.target.value===''?null:Number(e.target.value))}/></Field>
   </div>)}</div>
   <Field id={id('history')} label="Handling history"><select id={id('history')} value={value.handling_history || 'not_recorded'} onChange={e=>onChange({...value,handling_history:e.target.value,...(['unknown','breach'].includes(e.target.value)?{quarantined:true}:{})})}><option value="not_recorded">Not recorded</option><option value="documented">Documented</option><option value="unknown">Uncertain handling — hold batch</option><option value="breach">Known storage breach — hold batch</option></select></Field>
   <Field id={id('observations')} label="Storage evidence and observations"><textarea id={id('observations')} required={value.handling_history==='documented'} rows={3} maxLength={500} value={value.handling_note || ''} onChange={e=>set('handling_note',e.target.value)} placeholder="Known supplier packing time, temperatures and storage interruptions"/></Field>
   {!needsSource && guidance}
   <p>Opening and thawing need a date and documented days. These are calendar-day planning limits; hourly limits need owner review. Uncertain handling or a storage breach holds the batch.</p>
  </details>
  <details className="expiry-purchase"><summary>Supplier and cost (optional){value.supplier || value.unit_cost!=null || value.source_type && value.source_type!=='other'?' · recorded':''}</summary>
   <div className="expiry-fields-grid">
    <Field id={id('source')} label="Purchase source"><select id={id('source')} value={value.source_type || 'other'} onChange={e=>set('source_type',e.target.value)}><option value="other">Other / not recorded</option><option value="packaged">Packaged supermarket / supplier</option><option value="market">Wet market / unpackaged</option></select></Field>
    <Field id={id('supplier')} label="Supplier / shop (optional)"><input id={id('supplier')} maxLength={160} value={value.supplier || ''} onChange={e=>set('supplier',e.target.value)}/></Field>
   </div>
   <p>Purchase source does not determine whether there is a label. Wet-market stock can use documented received-date guidance when no package date is available.</p>
   <Field id={id('cost')} label="Batch purchase cost per inventory unit (RM, optional)"><input id={id('cost')} type="number" min="0" step="0.000001" value={value.unit_cost ?? ''} onChange={e=>set('unit_cost',e.target.value===''?null:e.target.value)}/></Field>
   <p>Match the ingredient unit: RM12/kg = RM0.012/g. Leave unknown costs blank.</p>
  </details>
  <label className="expiry-hold"><input type="checkbox" disabled={forcedHold} checked={forcedHold || !!value.quarantined} onChange={e=>set('quarantined',e.target.checked)}/><span>Hold batch — exclude from cooking stock</span></label>
  {forcedHold && <p>Handling needs review. Record the reviewed handling history before releasing this hold.</p>}
 </fieldset></div>;
}
