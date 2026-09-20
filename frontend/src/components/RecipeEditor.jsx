import PreparationTasks from './PreparationTasks';
import {apiError} from '../utils/apiError';
import {useEffect, useState} from 'react';
import axios from 'axios';
export default function RecipeEditor({value, onChange}) {
 const [materials,setMaterials]=useState([]),[error,setError]=useState('');
 useEffect(()=>{axios.get('/api/admin/raw-materials/').then(r=>setMaterials(r.data)).catch(e=>setError(apiError(e)));},[]);
 const rows=value.ingredients || [];
 const update=(i, key, v)=>onChange({...value, ingredients:rows.map((r,n)=>n===i?{...r,[key]:v}:r)});
 return <fieldset className="recipe-editor"><legend>Recipe & preorder settings</legend>
 <p role="alert">{error}</p><p>Quantities per portion. Include salt, oil and spices. Use each ingredient’s inventory unit.</p>
 {rows.map((r,i)=><div className="recipe-row" key={i}>
 <select aria-label="Ingredient" value={r.raw_material} onChange={e=>update(i,'raw_material',Number(e.target.value))}><option value="">Choose ingredient</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}</select>
 <input aria-label="Quantity per portion" type="number" min="0.001" step="0.001" value={r.quantity_required} onChange={e=>update(i,'quantity_required',e.target.value)}/>
 <button type="button" onClick={()=>onChange({...value,ingredients:rows.filter((_,n)=>n!==i)})}>Remove</button></div>)}
 <button type="button" onClick={()=>onChange({...value,ingredients:[...rows,{raw_material:'',quantity_required:''}]})}>+ Ingredient</button>
 <p>Create ingredients in Inventory first.</p>
 <h3>Production limits</h3><div className="admin-fields">{[['lead_hours','Advance notice (hours)',24],['batch_size','Portions per batch',1],['daily_capacity','Maximum portions delivered per day',30]].map(([key,label,fallback])=><label key={key}>{label}<input type="number" min="1" value={value[key] ?? fallback} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}</div>
 <p className="batch-help"><strong>What is a batch?</strong> Portions of this menu prepared together in one run, within one order. If one batch holds 10 portions, an order of 25 needs 3 batches (10 + 10 + 5). Separate orders are planned separately, even on the same day. Each extra batch adds the time you enter for each preparation step.</p><details><summary>Advance preparation limits</summary><p>These limits allow the planner to find earlier slots. Set them from your actual food handling process.</p><div className="admin-fields">{[['max_early_minutes','Maximum early finish before dispatch (minutes)',120,0],['max_preparation_days','Maximum span from first step to dispatch (days)',7,1]].map(([key,label,fallback,min])=><label key={key}>{label}<input type="number" min={min} value={value[key] ?? fallback} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}</div></details>
 {!(value.preparation_tasks?.length) && <details><summary>Basic estimate when no steps are recorded</summary>{[['preparation_minutes','First batch cooking (minutes)',60],['additional_batch_minutes','Each extra batch cooking (minutes)',60],['packing_minutes_per_portion','Packing per portion (minutes)',1]].map(([key,label,fallback])=><label key={key}>{label}<input type="number" min={key==='packing_minutes_per_portion'?0:1} value={value[key] ?? fallback} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}</details>}
 <PreparationTasks value={value} onChange={onChange}/><label>Food social media link<input type="url" value={value.social_url || ''} onChange={e=>onChange({...value,social_url:e.target.value})}/></label>
 </fieldset>;
}
