import {emptySellingDetails,sellingUnits,unitLabel} from '../utils/sellingDetails';
import SellingDetails from './SellingDetails';

export default function SellingDetailsEditor({value,onChange}){
 const details={...emptySellingDetails(),...value.selling_details};
 const update=(key,next)=>onChange({...value,selling_details:{...details,[key]:next}});
 return <fieldset className="selling-editor"><legend>Selling unit & contents</legend>
  <p>Customers buy one selling unit at the listed price. Use separate menus for different sizes or yields; changing a label does not rescale recipes or sales history.</p>
  <div className="selling-editor-grid"><label>Sold by<select value={details.unit} onChange={e=>update('unit',e.target.value)}>{Object.keys(sellingUnits).map(unit=><option key={unit} value={unit}>{unit[0].toUpperCase()+unit.slice(1)}</option>)}</select></label>
   <label>Size name (optional)<input maxLength={60} placeholder="For example: Small" value={details.size_label} onChange={e=>update('size_label',e.target.value)}/></label>
   <label>Estimated minimum servings<input type="number" min="1" max="1000" value={details.serves_min ?? ''} onChange={e=>update('serves_min',e.target.value===''?null:Number(e.target.value))}/></label>
   <label>Estimated maximum servings<input type="number" min="1" max="1000" value={details.serves_max ?? ''} onChange={e=>update('serves_max',e.target.value===''?null:Number(e.target.value))}/></label>
  </div>
  <p>Servings are optional estimates per {unitLabel(details)}, not the order quantity.</p>
  <label>What is in one {unitLabel(details)}? (optional)<textarea maxLength={500} placeholder="For example: 3 original, 2 salted egg, 2 dark chocolate and 2 matcha pieces." value={details.contents} onChange={e=>update('contents',e.target.value)}/></label>
  <label className="selling-fixed-choice"><input type="checkbox" checked={details.no_substitutions} onChange={e=>update('no_substitutions',e.target.checked)}/>Fixed contents; substitutions are unavailable</label>
  <label>How customers order<select value={details.ordering_mode} onChange={e=>update('ordering_mode',e.target.value)}><option value="local_preorder">Preorder for collection or local delivery</option><option value="shipping_enquiry">Shipping enquiry — agree arrangements first</option></select></label>
  {details.ordering_mode==='shipping_enquiry' && <section className="shipping-editor"><h4>Seasonal dispatch window</h4><p>This offer stays visible, with an enquiry button instead of checkout. Dispatch is when the parcel leaves you; arrival and courier fees must be agreed separately.</p><div className="selling-editor-grid"><label>Dispatch from<input type="date" value={details.dispatch_from || ''} onChange={e=>update('dispatch_from',e.target.value || null)}/></label><label>Dispatch through<input type="date" value={details.dispatch_through || ''} onChange={e=>update('dispatch_through',e.target.value || null)}/></label></div><label>Shipping arrangement note (optional)<textarea maxLength={300} value={details.shipping_note} onChange={e=>update('shipping_note',e.target.value)}/></label></section>}
  <SellingDetails details={details}/>
 </fieldset>;
}
