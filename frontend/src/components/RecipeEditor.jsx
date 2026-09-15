import {useEffect, useState} from 'react';
import axios from 'axios';
export default function RecipeEditor({value, onChange}) {
 const [materials,setMaterials]=useState([]);
 useEffect(()=>{axios.get('/api/admin/raw-materials/').then(r=>setMaterials(r.data)).catch(()=>setMaterials([]));},[]);
 const rows=value.ingredients || [];
 const update=(i, key, v)=>onChange({...value, ingredients:rows.map((r,n)=>n===i?{...r,[key]:v}:r)});
 return <fieldset className="recipe-editor"><legend>Recipe & preorder settings</legend>
 <p>Quantities per portion. Include salt, oil and spices. Use each ingredient’s inventory unit.</p>
 {rows.map((r,i)=><div className="recipe-row" key={i}>
 <select aria-label="Ingredient" value={r.raw_material} onChange={e=>update(i,'raw_material',Number(e.target.value))}><option value="">Choose ingredient</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}</select>
 <input aria-label="Quantity per portion" type="number" min="0.001" step="0.001" value={r.quantity_required} onChange={e=>update(i,'quantity_required',e.target.value)}/>
 <button type="button" onClick={()=>onChange({...value,ingredients:rows.filter((_,n)=>n!==i)})}>Remove</button></div>)}
 <button type="button" onClick={()=>onChange({...value,ingredients:[...rows,{raw_material:'',quantity_required:''}]})}>+ Ingredient</button>
 <p>Create ingredients in Inventory first.</p>
 {[['lead_hours','Advance notice (hours)',24],['preparation_minutes','Cooking time per order line (minutes)',60],['daily_capacity','Maximum portions per day',30]].map(([key,label,fallback])=><label key={key}>{label}<input type="number" min="1" value={value[key] ?? fallback} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}
 <label>Food social media link<input type="url" value={value.social_url || ''} onChange={e=>onChange({...value,social_url:e.target.value})}/></label>
 </fieldset>;
}
