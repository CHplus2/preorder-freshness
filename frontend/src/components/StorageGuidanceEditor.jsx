import {useId} from 'react';
import {storageNames} from '../utils/storageGuidance';
import './ExpiryFields.css';

export default function StorageGuidanceEditor({value=[],onChange,disabled=false}){
 const prefix=useId();
 const update=(index,key,next)=>onChange(value.map((row,i)=>i===index?{...row,[key]:next}:row));
 const remaining=Object.keys(storageNames).filter(storage=>!value.some(row=>row.storage_type===storage));
 return <div className="expiry-evidence-panel"><fieldset className="storage-guidance-editor" disabled={disabled}>
  <legend>Reusable storage guidance (optional)</legend>
  <p>Save a reference you have checked for this ingredient. Days count from receipt. Include the ingredient’s state, temperature and handling conditions. Existing batches keep their saved evidence and dates.</p>
  <p><a href="https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts" target="_blank" rel="noopener noreferrer">Review the FoodSafety.gov storage chart</a>. Guidance must match the actual batch; no durations are filled automatically.</p>
  {value.length===0 && <p>No saved guidance. You can still enter custom documented shelf life when adding stock.</p>}
  {value.map((row,index)=><fieldset className="storage-guidance-entry" key={index}>
   <legend>Guidance {index+1}</legend>
   <label htmlFor={`${prefix}-${index}-storage`}>Storage type</label>
   <select id={`${prefix}-${index}-storage`} value={row.storage_type} onChange={e=>update(index,'storage_type',e.target.value)}>{Object.entries(storageNames).filter(([storage])=>storage===row.storage_type || !value.some(other=>other.storage_type===storage)).map(([storage,name])=><option key={storage} value={storage}>{name}</option>)}</select>
   <label htmlFor={`${prefix}-${index}-days`}>Documented days from receipt</label>
   <input id={`${prefix}-${index}-days`} type="number" min="1" max="3650" step="1" value={row.shelf_life_days ?? ''} onChange={e=>update(index,'shelf_life_days',e.target.value===''?'':Number(e.target.value))}/>
   <label htmlFor={`${prefix}-${index}-source`}>Source / document reference</label>
   <input id={`${prefix}-${index}-source`} maxLength={140} value={row.source} onChange={e=>update(index,'source',e.target.value)}/>
   <label htmlFor={`${prefix}-${index}-conditions`}>Ingredient state and storage conditions</label>
   <textarea id={`${prefix}-${index}-conditions`} rows={3} maxLength={155} value={row.conditions} onChange={e=>update(index,'conditions',e.target.value)} placeholder="State (e.g. raw, unopened), temperature and handling assumptions from your source"/>
   <button type="button" onClick={()=>onChange(value.filter((_,i)=>i!==index))}>Remove guidance {index+1}</button>
  </fieldset>)}
  {remaining.length>0 && <button type="button" onClick={()=>onChange([...value,{storage_type:remaining[0],shelf_life_days:'',source:'',conditions:''}])}>Add storage guidance</button>}
  <p>Save up to one entry per storage type, or leave this section empty. These are planning references, not a food-safety assessment.</p>
 </fieldset></div>;
}
