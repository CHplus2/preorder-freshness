export default function ExpiryFields({value, onChange}) {
 const set=(key,v)=>onChange({...value,[key]:v});
 return <fieldset><legend>How is the shelf life recorded?</legend>
 <label>Expiry source<select value={value.expiry_basis || 'label'} onChange={e=>set('expiry_basis',e.target.value)}><option value="label">Printed expiry date</option><option value="manufactured">Manufacture date + documented shelf life</option><option value="storage">Wet market / unpackaged: receipt + storage life</option></select></label>
 <label>Storage<select value={value.storage_type || 'chilled'} onChange={e=>set('storage_type',e.target.value)}><option value="chilled">Chilled</option><option value="frozen">Frozen</option><option value="ambient">Ambient</option></select></label>
 {value.expiry_basis === 'manufactured' && <label>Manufacture date<input type="date" value={value.manufactured_date || ''} onChange={e=>set('manufactured_date',e.target.value)}/></label>}
 {value.expiry_basis && value.expiry_basis !== 'label' && <><label>Documented shelf life (days)<input type="number" min="1" value={value.shelf_life_days || ''} onChange={e=>set('shelf_life_days',Number(e.target.value))}/></label><label>Guidance source and storage conditions<input value={value.guidance_note || ''} placeholder="Supplier instructions / published storage guidance" onChange={e=>set('guidance_note',e.target.value)}/></label><p>Expiry is calculated by the server from the selected start date. Dates do not measure food safety. Never extend shelf life after unsafe storage.</p></>}
 <label><input type="checkbox" checked={value.quarantined || false} onChange={e=>set('quarantined',e.target.checked)}/> Hold batch — exclude from cooking stock</label>
 <a href="https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts" target="_blank" rel="noreferrer">Published cold-storage guidance</a>
 </fieldset>;
}
