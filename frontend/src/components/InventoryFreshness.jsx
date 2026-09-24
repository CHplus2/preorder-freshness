import {useEffect,useState} from 'react';
import axios from 'axios';
export default function InventoryFreshness(){
 const [data,setData]=useState(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setError(false);axios.get('/api/inventory-freshness/',{signal:c.signal}).then(r=>setData(r.data)).catch(e=>{if(!axios.isCancel(e))setError(true)});return()=>c.abort()},[retry]);
 return <section className="inventory-transparency" aria-label="Ingredient storage records"><h2>Inside the kitchen's inventory</h2>
 {error?<p role="status">Inventory records are temporarily unavailable. <button onClick={()=>setRetry(n=>n+1)}>Try again</button></p>:!data?<p role="status">Loading storage records...</p>:<>
 <p><strong>{data.average_remaining_percent===null?'Not available':data.average_remaining_percent+'%'}</strong> average recorded shelf-life remaining</p>
 <p>{data.recorded_batches} batches in stock / {data.expired_batches} past recorded expiry / {data.held_batches} on hold / {data.unknown_batches} with insufficient records. Updated for {data.as_of} (Malaysia).</p>
 <details><summary>How this is calculated</summary><p>{data.method}</p><p>This is a date-based storage indicator, not measured freshness or a food-safety score. It depends on accurate owner records and correct storage. An overall average does not describe every ingredient or the batches used for your future order. Held and expired stock is excluded from cooking.</p></details>
 </>}</section>
}
