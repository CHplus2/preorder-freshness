import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import axios from 'axios';
import {useAuth} from '../contexts/AuthContext';
import {stockReadiness,stockWorksheet} from '../utils/stockReadiness';
import {readApiError} from '../utils/apiError';
import './StockReadiness.css';
const amount=value=>Number(value).toLocaleString('en-MY',{maximumFractionDigits:3});
export default function StockReadiness({today,onAddIngredient,disabled=false}){
 const {isSessionCurrent}=useAuth();
 const [form,setForm]=useState({date:today,quantity:'1'}),[selection,setSelection]=useState(null),[result,setResult]=useState(null),[tab,setTab]=useState('ingredients'),[downloadError,setDownloadError]=useState('');
 const sequence=useRef(0);
 const formKey=JSON.stringify([form.date,Number(form.quantity)]);
 const current=selection&&selection.key===formKey;
 const response=current&&result?.attempt===selection.attempt?result:null;
 const loading=!!current&&!response;
 const data=response?.data;
 useEffect(()=>{
  if(!selection)return;
  const c=new AbortController();
  axios.get('/api/admin/stock-readiness/',{params:{date:selection.date,quantity:selection.quantity},signal:c.signal,timeout:15000})
   .then(({data})=>{const next=stockReadiness(data,selection.date,selection.quantity);if(!c.signal.aborted&&isSessionCurrent())setResult({attempt:selection.attempt,data:next})})
   .catch(e=>{if(!c.signal.aborted&&isSessionCurrent())setResult({attempt:selection.attempt,error:readApiError(e,'Could not check stock.')})});
  return()=>c.abort();
 },[selection,isSessionCurrent]);
 useEffect(()=>{const refresh=()=>setSelection(old=>old?{...old,attempt:++sequence.current}:null);window.addEventListener('inventory-updated',refresh);return()=>window.removeEventListener('inventory-updated',refresh)},[]);
 const check=e=>{e?.preventDefault();setSelection({date:form.date,quantity:Number(form.quantity),key:formKey,attempt:++sequence.current})};
 const download=()=>{let url;setDownloadError('');try{url=URL.createObjectURL(new Blob(['\ufeff'+stockWorksheet(data)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`stock-worksheet-${data.date}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{if(url)URL.revokeObjectURL(url);setDownloadError('The worksheet could not be downloaded. You can still review the targets below.')}};
 const maxDay=new Date(today+'T00:00:00Z');maxDay.setUTCDate(maxDay.getUTCDate()+90);
 return <details className="stock-readiness"><summary>Check ingredients &amp; packaging for your menus</summary>
  <p>Choose a date and units of each menu offered that day. This calculates a replenishment target from your saved recipes; it does not add stock or reserve orders.</p>
  <form className="stock-readiness-form" onSubmit={check}><label>Planning date<input required type="date" min={today} max={maxDay.toISOString().slice(0,10)} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Units of each offered menu<input required type="number" min="1" max="100" step="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></label><button disabled={disabled||loading} type="submit">{loading?'Checking stock…':'Check stock'}</button></form>
  {selection&&!current&&<p role="status">Your date or quantity changed. Run the check again to see matching targets.</p>}
  {response?.error&&<div role="alert"><p>{response.error}</p><button disabled={disabled} onClick={check} type="button">Retry stock check</button></div>}
  {data&&<div className="stock-readiness-results">
   <h3>{data.state==='covered'?'Recorded stock covers this target':data.state==='no_menus'?'No menus offered on this date':data.state==='review'?'Review menu or packaging settings':'Stock to replenish'}</h3>
   <p>{data.menus.length} offered menus × {data.quantity_per_menu} units each · {data.date}. {data.excluded_menus.length>0&&`${data.excluded_menus.length} other menus are not offered on this date.`}</p>
   {data.issues.length>0&&<ul>{data.issues.map(r=><li key={r.id}><Link to="/admin/products">{r.name}</Link>: {r.detail}</li>)}</ul>}
   <div className="stock-readiness-actions"><div role="group" aria-label="Stock target type"><button type="button" aria-pressed={tab==='ingredients'} onClick={()=>setTab('ingredients')}>Ingredients</button><button type="button" aria-pressed={tab==='packaging'} onClick={()=>setTab('packaging')}>Packaging</button></div><button type="button" onClick={download}>Download stock worksheet</button></div>
   {downloadError&&<p role="alert">{downloadError}</p>}
   <div className="stock-readiness-table"><table><caption>{tab==='ingredients'?'Ingredient targets':'Packaging targets'} · totals across the offered menus</caption><thead><tr><th scope="col">Item</th><th scope="col">Target</th><th scope="col">Available</th><th scope="col">Shortfall</th><th scope="col">Record received stock</th></tr></thead><tbody>{data[tab].map(row=><tr key={row.id}><th scope="row">{row.name}{row.is_active===false&&<small>Inactive packaging — review before ordering</small>}</th><td>{amount(row.required)} {row.unit||'pieces'}</td><td>{amount(row.available)} {row.unit||'pieces'}</td><td>{amount(row.shortfall)} {row.unit||'pieces'}</td><td>{tab==='ingredients'?<button type="button" disabled={disabled} onClick={()=>onAddIngredient(row.id)} aria-label={`Add received ${row.name}`}>Add batch</button>:<Link to={`/admin/packaging?item=${row.id}`}>Update stock</Link>}</td></tr>)}</tbody></table>{data[tab].length===0&&<p>No {tab} to list for these menus.</p>}</div>
   <p className="stock-readiness-note">Only received, unheld ingredient batches whose recorded deadline covers this date count as available. Packaging uses its current recorded balance. Opening and thawing limits still apply. Targets are not physical counts: enter quantities actually received and their date evidence in the stock form. Checkout rechecks the complete basket and offered times.</p>
   <p className="stock-readiness-note">Checked {new Date(data.checked_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})} Malaysia time. No stock was changed by this check or worksheet.</p>
  </div>}
 </details>;
}
