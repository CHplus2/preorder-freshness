import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import axios from 'axios';
import {unitLabel} from '../utils/sellingDetails';

export default function MenuVariants({product}){
 const [result,setResult]=useState(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const group=product.selling_details?.variant_group;
 useEffect(()=>{
  if(!group)return;
  const controller=new AbortController();
  axios.get(`/api/products/${product.id}/variants/`,{signal:controller.signal}).then(({data})=>{
   if(data.group!==group || !Array.isArray(data.results) || data.results.some(p=>!Number.isSafeInteger(p.id) || p.id<1 || !Number.isFinite(Number(p.price))))throw new Error('Invalid sizes');
   setResult(data);setError(false);
  }).catch(e=>{if(!axios.isCancel(e))setError(true);});
  return()=>controller.abort();
 },[product.id,group,attempt]);
 if(!group)return null;
 return <section className="menu-variants" aria-label="Menu sizes"><h2>Choose a size</h2><p>Each size has its own price and availability. Basket items stay as selected.</p>{error?<p role="status">Other sizes could not be loaded. <button onClick={()=>setAttempt(n=>n+1)}>Try again</button></p>:!result?<p role="status">Loading sizes…</p>:<div className="menu-variant-options">{result.results.map(p=><Link key={p.id} aria-current={p.id===product.id?'page':undefined} to={`/products/${p.id}`}><strong>{p.selling_details?.size_label || p.name}</strong><span>RM {Number(p.price).toFixed(2)} / {unitLabel(p.selling_details)}</span></Link>)}</div>}</section>;
}
