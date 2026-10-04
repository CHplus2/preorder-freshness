import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import axios from 'axios';
import {useCart} from '../contexts/CartContext';
import {useProduct} from '../contexts/ProductContext';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
const headers=()=>({'X-CSRFToken':getCookie('csrftoken')});
const sendEvent=(session,event,product=null)=>axios.post('/api/recommendation/events/',{session,event,product,request_id:crypto.randomUUID()},{headers:headers()}).catch(()=>{});
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
export default function GuidedMenu(){
  const [form,setForm]=useState({date:'',portions:1,budget:'',category:''});
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const {addToCart}=useCart();const {categories}=useProduct();const generation=useRef(0);
  const track=(event,product=null,session=data?.session)=>session?axios.post('/api/recommendation/events/',{session,event,product,request_id:crypto.randomUUID()},{headers:headers()}).catch(()=>{}):Promise.resolve();
  useEffect(()=>{if(data?.results.length){sessionStorage.setItem('recommendationSession',data.session);sendEvent(data.session,'impression')}},[data]);
  const search=async e=>{e.preventDefault();if(busy)return;const version=++generation.current;setBusy(true);setError('');setData(null);
    try{const r=await axios.post('/api/menu/guide/',{date:form.date,portions:Number(form.portions),...(form.budget?{budget:form.budget}:{}),...(form.category?{category:Number(form.category)}:{})},{headers:headers()});if(version===generation.current)setData(r.data)}
    catch(e){if(version===generation.current)setError(apiError(e))}finally{if(version===generation.current)setBusy(false)}
  };
  const add=async (row,slot)=>{sessionStorage.setItem('preferredDelivery',slot.delivery_at);sessionStorage.setItem('recommendationSession',data.session);await track('click',row.id);const saved=await addToCart(row.id,row.portions);if(saved)await track('added',row.id)};
  return <details className="dk-panel guided-menu"><summary>Need help choosing? Find food for your date</summary><p>Choose a date and group size to see up to three suggestions.</p>
    <form className="fyp-form inline" onSubmit={search}>
      <label>Delivery date<input type="date" required min={today()} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
      <label>Portions<input type="number" required min="1" max="100" value={form.portions} onChange={e=>setForm({...form,portions:e.target.value})}/></label>
      <label>Total food budget (RM, optional)<input type="number" min="0.01" step="0.01" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})}/></label>
      <label>Preference<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">Any category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button disabled={busy}>{busy?'Checking kitchen times…':'Find my options'}</button>
    </form>{error && <p role="alert">{error}</p>}
    {data && <><details className="guide-method"><summary>How suggestions work</summary><p>{data.message}</p></details>{data.results.length===0?<p>No matching delivery times found. Try another date or budget, or browse the menu below.</p>:<div className="guide-results">{data.results.map(row=><article key={row.id}><h3><Link to={`/products/${row.id}`} onClick={()=>track('click',row.id)}>{row.name}</Link></h3><p>RM {row.food_total} for {row.portions} portions</p><ul>{row.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p>Choose a suggested delivery time (Malaysia):</p>{row.slots.map(slot=><button type="button" key={slot.delivery_at} onClick={()=>add(row,slot)}>{new Date(slot.delivery_at).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'})} · Add {row.portions}</button>)}</article>)}</div>}</>}
    <p>Allergies or dietary needs? Check with the kitchen before ordering.</p>
  </details>;
}
