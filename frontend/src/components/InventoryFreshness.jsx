import {useEffect,useState} from 'react';
import axios from 'axios';
export default function InventoryFreshness(){
 const [data,setData]=useState(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setError(false);axios.get('/api/inventory-freshness/',{signal:c.signal}).then(r=>setData(r.data)).catch(e=>{if(!axios.isCancel(e))setError(true)});return()=>c.abort()},[retry]);
 return <details id="inventory-freshness" className="inventory-transparency">
 <summary>Ingredient storage records <span>View current batch dates and stock on hold</span></summary>
 {error?<p role="status">Inventory records are temporarily unavailable. <button onClick={()=>setRetry(n=>n+1)}>Try again</button></p>:!data?<p role="status">Loading storage records...</p>:<>
 <h2>What is in storage today?</h2>
 <p>A batch is one recorded lot of an ingredient, such as a delivery of chicken. These counts describe the kitchen's current records, not the ingredients already used in your meal.</p>
 <ul className="inventory-status-list">
 <li><strong>{data.within_date_batches ?? 'Unavailable'}</strong> batches within their recorded date and not on hold</li>
 <li><strong>{data.expired_batches}</strong> batches past their recorded expiry — excluded from cooking stock</li>
 <li><strong>{data.held_batches}</strong> batches on hold — excluded from cooking stock</li>
 <li><strong>{data.unknown_batches}</strong> batches without enough information for a shelf-life estimate</li>
 </ul>
 <p>{data.recorded_batches} batches recorded in stock. Held batches may also be past expiry, so these counts can overlap. Calculated for {data.as_of} (Malaysia).</p>
 <p>Dates alone cannot confirm freshness or food safety. Records depend on correct storage and owner updates; future orders may use newly purchased ingredients.</p>
 <details><summary>Show the date-based average</summary>
 <p><strong>{data.average_remaining_percent===null?'Not available':data.average_remaining_percent+'%'}</strong> average recorded shelf-life remaining. This is the average proportion of each recorded storage window left, not a percentage of how fresh the food is.</p>
 <p>{data.method}</p></details>
 </>}</details>
}
