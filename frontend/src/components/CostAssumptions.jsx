import {useState} from 'react';
import {Link} from 'react-router-dom';
import {costUnits,displayUnitCost,inventoryUnitCost} from '../utils/costEntry';

function IngredientCostRow({material,busy,onSave}){
 const units=costUnits(material.unit),[factor,setFactor]=useState(units[0].factor);
 const [value,setValue]=useState(()=>displayUnitCost(material.estimated_unit_cost,units[0].factor));
 const [error,setError]=useState(''),[saved,setSaved]=useState(false);
 const submit=async event=>{
  event.preventDefault();setError('');setSaved(false);
  try{if(await onSave(material.id,inventoryUnitCost(value,factor)))setSaved(true)}catch(error){setError(error.message)}
 };
 return <form className="cost-input-row" onSubmit={submit}>
  <div className="cost-ingredient-name"><strong>{material.name}</strong><small>{material.estimated_unit_cost===null?'Cost not recorded':'Current estimate saved'}</small></div>
  <label><span className="sr-only">{material.name} price in RM</span><input type="number" min="0" step="any" disabled={busy} value={value} placeholder="Not recorded" onChange={event=>{setValue(event.target.value);setSaved(false)}}/></label>
  <label><span className="sr-only">Price unit for {material.name}</span><select disabled={busy} value={factor} onChange={event=>{const next=Number(event.target.value);if(value!=='')setValue(String(Number(value)/factor*next));setFactor(next);setSaved(false)}}>{units.map(unit=><option value={unit.factor} key={unit.factor}>RM / {unit.label}</option>)}</select></label>
  <button type="submit" disabled={busy}>Save cost<span className="sr-only"> for {material.name}</span></button>
  {error&&<p role="alert" className="cost-row-feedback">{error}</p>}{saved&&<p role="status" className="cost-row-feedback">Cost saved.</p>}
 </form>;
}

export default function CostAssumptions({materials,busy,onSave}){
 const [search,setSearch]=useState('');
 const matches=material=>material.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
 return <details className="cost-section" id="ingredient-costs"><summary><span>Ingredient cost estimates</span><small>Set current supplier prices for the pricing tools</small></summary><div className="cost-section-body">
  <p>Enter the price in a familiar unit, such as RM 12 per kg. The system converts it to the ingredient’s inventory unit. Leave unknown costs blank; enter 0 only when the ingredient has no cost.</p>
  <p>These estimates affect pricing comparisons. Past orders keep their recorded batch purchase costs. <Link to="/admin/packaging">Update packaging unit costs</Link>.</p>
  <label>Find an ingredient<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search ingredients"/></label>
  <p className="cost-scope-note">{materials.filter(matches).length} of {materials.length} ingredients</p>
  <div className="cost-assumption-list">{materials.map(material=><div key={material.id} hidden={!matches(material)}><IngredientCostRow key={material.estimated_unit_cost??'unknown'} material={material} busy={busy} onSave={onSave}/></div>)}</div>
  {!materials.some(matches)&&<p>No ingredients match this search.</p>}
 </div></details>;
}
