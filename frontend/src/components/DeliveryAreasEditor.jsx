import {useId,useRef,useState} from 'react';
import {Pencil,Trash2,Plus} from 'lucide-react';
import {areaFee,changeDeliveryArea,removeDeliveryArea} from '../utils/deliveryAreaEditor';
import './DeliveryAreasEditor.css';
export default function DeliveryAreasEditor({store,onChange,disabled=false,error='',onSave,saving=false,saveLabel='Save delivery areas & fees',saveHelp='Save to apply this list and its fees to new orders. Existing orders keep their agreed area and fee.'}){
 const id=useId(),nameRef=useRef(null);
 const [editing,setEditing]=useState(null),[name,setName]=useState(''),[fee,setFee]=useState(''),[issue,setIssue]=useState('');
 const areas=store.delivery_areas||[];
 const reset=()=>{setEditing(null);setName('');setFee('');setIssue('')};
 const apply=()=>{try{onChange(changeDeliveryArea(store,editing,name,fee));reset();nameRef.current?.focus()}catch(e){setIssue(e.message);nameRef.current?.focus()}};
 const edit=area=>{setEditing(area);setName(area);setFee(String(areaFee(store,area)));setIssue('');nameRef.current?.focus()};
 const remove=area=>{onChange(removeDeliveryArea(store,area));if(editing===area)reset()};
 const enter=e=>{if(e.key==='Enter'){e.preventDefault();apply()}};
 const save=()=>{if(name.trim()||editing!==null){setIssue('Choose Add to list or Update list before saving your delivery fees.');nameRef.current?.focus();return;}onSave?.()};
 const free=store.free_delivery_minimum_myr!=null;
 return <section className="delivery-areas-editor" aria-labelledby={id+'-title'}>
  <h3 id={id+'-title'}>Delivery areas &amp; fees</h3><p>List the areas you serve and the fee per order. Customers choose their area at checkout.</p>
  <details className="area-naming-help"><summary>How should I name an area?</summary><p>Use neighbourhoods, towns or clearly named zones that share one fee. Whole-city names work if one price covers the whole city. For example, Petra Jaya and Kota Samarahan can have separate fees. Avoid overlapping choices; keep the broader coverage description in your kitchen profile.</p></details>
  {areas.length?<ul className="delivery-area-list">{areas.map(area=><li key={area}><div><strong>{area}</strong><span>RM {Number(areaFee(store,area)).toFixed(2)} per order{!Object.hasOwn(store.delivery_area_fees||{},area)&&<small>Uses default fee</small>}</span></div><div className="delivery-area-row-actions"><button type="button" disabled={disabled} onClick={()=>edit(area)} aria-label={'Edit '+area}><Pencil size={16} aria-hidden="true"/>Edit</button><button type="button" disabled={disabled} onClick={()=>remove(area)} aria-label={'Remove '+area}><Trash2 size={16} aria-hidden="true"/>Remove</button></div></li>)}</ul>:<p className="delivery-area-empty">No areas are listed. Delivery is available to any area at the default fee. To stop delivery orders, turn Offer delivery off.</p>}
  <div className="delivery-area-draft"><h4>{editing!==null?'Edit delivery area':'Add delivery area'}</h4><div className="delivery-area-fields"><label htmlFor="delivery-area-names">Area name<input ref={nameRef} id="delivery-area-names" maxLength="80" value={name} disabled={disabled} placeholder="e.g. Petra Jaya" onChange={e=>{setName(e.target.value);setIssue('')}} onKeyDown={enter}/></label><label htmlFor={id+'-fee'}>Fee per order (RM)<input id={id+'-fee'} type="number" min="0" max="999999.99" step="0.01" value={fee} disabled={disabled} placeholder="5.00" onChange={e=>{setFee(e.target.value);setIssue('')}} onKeyDown={enter}/></label></div><div className="delivery-area-draft-actions"><button type="button" disabled={disabled||areas.length>=30&&editing===null} onClick={apply}><Plus size={16} aria-hidden="true"/>{editing!==null?'Update list':'Add to list'}</button>{editing!==null&&<button type="button" disabled={disabled} onClick={reset}>Cancel edit</button>}</div></div>
  {(issue||error)&&<p className="settings-field-error" role="alert">{issue||error}</p>}
  <div className="delivery-area-policy"><label>Default delivery fee (RM)<input required type="number" min="0" max="999999.99" step="0.01" value={store.delivery_fee_myr??'5.00'} disabled={disabled} onChange={e=>onChange({...store,delivery_fee_myr:e.target.value})}/></label><p>Used when an area has no separate fee, or when no areas are listed.</p>
  <label className="delivery-free-toggle"><input type="checkbox" checked={free} disabled={disabled} onChange={e=>onChange({...store,free_delivery_minimum_myr:e.target.checked?'50.00':null})}/>Offer free delivery above a food subtotal</label>
  {free&&<label>Free delivery from food subtotal (RM)<input required type="number" min="0" max="999999.99" step="0.01" value={store.free_delivery_minimum_myr} disabled={disabled} onChange={e=>onChange({...store,free_delivery_minimum_myr:e.target.value})}/></label>}
  <p className="delivery-fee-summary">{free?(Number(store.free_delivery_minimum_myr)===0?'RM0 makes delivery free for every order.':`Area fees apply below RM ${Number(store.free_delivery_minimum_myr||0).toFixed(2)}. Orders reaching that food subtotal have free delivery.`):'Each delivery order pays its selected area’s fee. Self-collection has no delivery fee.'}</p></div>
  {onSave&&<button className="delivery-area-save" type="button" disabled={disabled} onClick={save}>{saving?'Saving…':saveLabel}</button>}
  <p className="delivery-area-save-help">{saveHelp}</p>
 </section>;
}
