import {responseList} from '../utils/apiResponse';
import MenuDeliveryDays from './MenuDeliveryDays';
import PreparationEstimate from './PreparationEstimate';
import PreparationTasks from './PreparationTasks';
import {apiError} from '../utils/apiError';
import {useEffect, useState} from 'react';
import axios from 'axios';
export default function RecipeEditor({value, onChange}) {
 const [materials,setMaterials]=useState([]),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();axios.get('/api/admin/raw-materials/',{signal:controller.signal}).then(r=>{setMaterials(responseList(r.data));setError('');}).catch(e=>{if(!axios.isCancel(e))setError(apiError(e));});return()=>controller.abort();},[retry]);
 const rows=value.ingredients || [];
 const update=(i, key, v)=>onChange({...value, ingredients:rows.map((r,n)=>n===i?{...r,[key]:v}:r)});
 return <fieldset className="recipe-editor"><legend>Recipe & preorder settings</legend>
 {error && <p className="recipe-load-error" role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry ingredients</button></p>}<p>Quantities per portion. Include salt, oil and spices. Use each ingredient’s inventory unit.</p>
 {rows.map((r,i)=><div className="recipe-row" key={i}>
 <select aria-label="Ingredient" disabled={!!error} value={r.raw_material} onChange={e=>update(i,'raw_material',Number(e.target.value))}><option value="">Choose ingredient</option>{r.raw_material && !materials.some(m=>Number(m.id)===Number(r.raw_material)) && <option value={r.raw_material}>Ingredient #{r.raw_material} · {error?'details unavailable':'loading details'}</option>}{materials.map(m=><option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}</select>
 <input aria-label="Quantity per portion" type="number" min="0.001" step="0.001" value={r.quantity_required} onChange={e=>update(i,'quantity_required',e.target.value)}/>
 <button type="button" onClick={()=>onChange({...value,ingredients:rows.filter((_,n)=>n!==i)})}>Remove</button></div>)}
 <button type="button" onClick={()=>onChange({...value,ingredients:[...rows,{raw_material:'',quantity_required:''}]})}>+ Ingredient</button>
 <p>Create ingredients in Inventory first.</p>
 <label data-review-cost>Packaging cost per portion (RM)<input type="number" min="0" step="0.01" value={value.packaging_cost ?? ''} onChange={e=>onChange({...value,packaging_cost:e.target.value===''?null:e.target.value})}/></label><p>Include container, bag and label. Enter 0 only if packaging is free; blank means unknown.</p><h3>Production limits</h3><div className="admin-fields">{[['lead_hours','Advance notice (hours)',24],['batch_size','Portions per batch',1],['daily_capacity','Maximum portions delivered per day',30]].map(([key,label,fallback])=><label key={key}>{label}<input type="number" min="1" value={value[key] ?? fallback} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}</div>
 <p className="batch-help"><strong>What is a batch?</strong> Portions of this menu prepared together in one run, within one order. If one batch holds 10 portions, an order of 25 needs 3 batches (10 + 10 + 5). Separate orders are planned separately, even on the same day. Each extra batch adds the time you enter for each preparation step.</p><details><summary>Advance preparation limits</summary><p>These limits allow the planner to find earlier slots. Set them from your actual food handling process.</p><div className="admin-fields">{[['max_early_minutes','Maximum early finish before dispatch (minutes)',120,0],['max_preparation_days','Maximum span from first step to dispatch (days)',7,1]].map(([key,label,fallback,min])=><label key={key}>{label}<input type="number" min={min} value={value[key] ?? fallback} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}</div></details>
 {!(value.preparation_tasks?.length) && <details><summary>Basic estimate when no steps are recorded</summary>{[['preparation_minutes','First batch cooking (minutes)',60],['additional_batch_minutes','Each extra batch cooking (minutes)',60],['packing_minutes_per_portion','Packing per portion (minutes)',1]].map(([key,label,fallback])=><label key={key}>{label}<input type="number" min={key==='packing_minutes_per_portion'?0:1} value={value[key] ?? fallback} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}</details>}
 <MenuDeliveryDays value={value.delivery_weekdays || []} onChange={delivery_weekdays=>onChange({...value,delivery_weekdays})}/>
 <PreparationTasks value={value} onChange={onChange}/><PreparationEstimate menu={value}/><label>Food video or social post link (TikTok, Instagram, YouTube)<input type="url" value={value.social_url || ''} onChange={e=>onChange({...value,social_url:e.target.value})}/></label>
 </fieldset>;
}
