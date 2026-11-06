import {useId} from 'react';
import ModalDialog from './ModalDialog';
import InventoryFeedback from './InventoryFeedback';
import ExpiryFields from './ExpiryFields';
import StorageGuidanceEditor from './StorageGuidanceEditor';
import {changeBatchMaterial} from '../utils/storageGuidance';
import {stockQuantity} from '../utils/stockShortage';

export function IngredientForm({value,onChange,onSave,onClose,busy,error}){
 const id=useId(),editing=!!value.id;
 return <ModalDialog label={editing?'Edit ingredient':'Add ingredient'} onDismiss={onClose}><div className="modal-overlay"><form className="modal-content inventory-entry-form" onSubmit={event=>{event.preventDefault();if(!busy)onSave()}}>
  <header><div><h2>{editing?'Edit ingredient':'Add ingredient'}</h2><p>Choose the unit used in recipes and stock batches.</p></div><button type="button" disabled={busy} onClick={onClose}>Close</button></header>
  <InventoryFeedback message={error}/>
  <fieldset disabled={busy} className="inventory-entry-fields"><legend className="sr-only">Ingredient details</legend>
   <label htmlFor={id+'-name'}>Ingredient name<input id={id+'-name'} data-initial-focus required maxLength={100} value={value.name} onChange={event=>onChange({...value,name:event.target.value})} placeholder="e.g. Chicken boneless trimmed"/></label>
   <label htmlFor={id+'-unit'}>Inventory unit<select id={id+'-unit'} value={value.unit} onChange={event=>onChange({...value,unit:event.target.value})}><option value="g">Gram (g)</option><option value="kg">Kilogram (kg)</option><option value="ml">Millilitre (ml)</option><option value="l">Litre (l)</option><option value="unit">Unit</option></select></label>
   {editing&&<p className="inventory-entry-help">Existing stock and recipes use this unit. A used ingredient’s unit cannot be changed.</p>}
   <details className="inventory-entry-optional"><summary>Reusable storage guidance (optional){value.storage_guidance?.length?` · ${value.storage_guidance.length} saved`:''}</summary><StorageGuidanceEditor value={value.storage_guidance||[]} disabled={busy} onChange={storage_guidance=>onChange({...value,storage_guidance})}/></details>
  </fieldset>
  <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="inventory-entry-primary" disabled={busy}>{busy?'Saving…':editing?'Save ingredient':'Add ingredient'}</button></footer>
 </form></div></ModalDialog>;
}
export function InventoryBatchForm({value,onChange,materials,originalQuantity,onSave,onClose,onReload,busy,error,today}){
 const id=useId(),editing=!!value.id,material=materials.find(row=>row.id===Number(value.raw_material));
 const unit=material?.unit||value.unit||'',changed=editing&&Number(value.quantity)!==Number(originalQuantity);
 const field=(name,next)=>onChange({...value,[name]:next});
 return <ModalDialog label={editing?'Edit stock batch':'Add stock batch'} onDismiss={onClose}><div className="modal-overlay"><form className="modal-content inventory-entry-form inventory-form" onSubmit={event=>{event.preventDefault();if(!busy)onSave()}}>
  <header><div><h2>{editing?'Edit stock batch':'Add stock batch'}</h2><p>{editing?value.batch_code||'Stock batch':'Record ingredients that have reached the kitchen.'}</p></div><button type="button" disabled={busy} onClick={onClose}>Close</button></header>
  <InventoryFeedback message={error}>{editing&&<button type="button" disabled={busy} onClick={onReload}>Reload latest batch (discards edits)</button>}</InventoryFeedback>
  <fieldset disabled={busy} className="inventory-entry-fields"><legend className="sr-only">Batch details</legend>
   {editing?<div className="inventory-fixed-ingredient"><span>Ingredient</span><strong>{value.raw_material_name||material?.name}</strong></div>:<label htmlFor={id+'-ingredient'}>Ingredient<select id={id+'-ingredient'} data-initial-focus required value={value.raw_material} onChange={event=>onChange(changeBatchMaterial(value,event.target.value?Number(event.target.value):''))}><option value="">Choose an ingredient</option>{materials.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
   <div className="inventory-entry-grid"><label htmlFor={id+'-quantity'}>{editing?'Quantity remaining':'Quantity received'}{unit?` (${unit})`:''}<input id={id+'-quantity'} required type="number" min="0" step="0.001" value={value.quantity} onChange={event=>field('quantity',event.target.value)}/></label>
    <label htmlFor={id+'-received'}>Received on<input id={id+'-received'} required type="date" max={today} value={value.received_date||''} onChange={event=>field('received_date',event.target.value)}/></label></div>
   {changed&&<div className="inventory-adjustment-review"><p>Recorded: <strong>{stockQuantity(originalQuantity)} {unit}</strong> → New balance: <strong>{stockQuantity(value.quantity)} {unit}</strong>. This changes remaining stock.</p><label htmlFor={id+'-reason'}>Reason for quantity adjustment<input id={id+'-reason'} required maxLength={200} value={value.adjustment_reason||''} onChange={event=>field('adjustment_reason',event.target.value)} placeholder="e.g. Physical count correction"/></label><p>For discarded ingredients, use <a href="/admin/reports#costs">Record ingredient wastage</a> to keep a wastage cost record.</p></div>}
   <label htmlFor={id+'-location'}>Storage location<input id={id+'-location'} required maxLength={200} value={value.storage_location||''} onChange={event=>field('storage_location',event.target.value)} placeholder="e.g. Fridge A · sealed ingredient box"/></label>
   <ExpiryFields value={value} onChange={onChange} disabled={busy} material={material}/>
   <details className="inventory-entry-optional"><summary>Batch reference (optional){value.batch_code?` · ${value.batch_code}`:''}</summary><label htmlFor={id+'-code'}>Batch code<input id={id+'-code'} maxLength={100} value={value.batch_code||''} onChange={event=>field('batch_code',event.target.value)} placeholder="Leave blank to generate automatically"/></label><p>Leave blank for a standard ingredient–received date–batch number reference, or use the supplier’s batch code. Previous references stay in the history.</p></details>
  </fieldset>
  <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="inventory-entry-primary" disabled={busy}>{busy?'Saving…':editing?'Save batch changes':'Add stock batch'}</button></footer>
 </form></div></ModalDialog>;
}
