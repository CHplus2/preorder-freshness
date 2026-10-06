import {useState} from 'react';
import axios from 'axios';
import {readApiError} from '../utils/apiError';
export default function BatchTrace(){
 const [id,setId]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const search=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');setData(null);try{const r=await axios.get(`/api/admin/inventory-items/${id}/trace/`);setData(r.data)}catch(e){setError(readApiError(e))}finally{setBusy(false)}};
 return <details className="dk-panel"><summary>Trace an ingredient batch to orders</summary><form className="fyp-form inline" onSubmit={search}><label>Batch record ID<input type="number" required min="1" value={id} onChange={e=>setId(e.target.value)}/></label><button disabled={busy}>{busy?'Looking up…':'Find affected orders'}</button></form>{error && <p role="alert">{error}</p>}{data && <><p>Batch #{data.batch} {data.batch_code}. {data.note}</p>{data.orders.length?<ul>{data.orders.map((r,i)=><li key={i}>Order #{r.order}: {r.menu} · {r.quantity} {r.unit} · {r.status} · {new Date(r.consumed_at).toLocaleString('en-MY')}</li>)}</ul>:<p>No structured consumption recorded for this batch.</p>}</>}</details>
}
