import {useState} from 'react';
import axios from 'axios';
import {pricingResponse} from '../utils/costResponse';
import {readApiError} from '../utils/apiError';
import {getCookie} from '../utils/cookieUtils';
const money = value => value == null ? 'Unavailable' : `RM ${value}`;

export default function PricingPreview({menus,unavailableReason=''}) {
  const [form,setForm] = useState({product:'', portions:'10', price:'', discount_percent:'0', ingredient_increase_percent:'0', additional_cost_per_portion:'0'});
  const [result,setResult] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const change = (key,value) => {setForm({...form,[key]:value});setResult(null);setError('');};
  const submit = async event => {
    event.preventDefault();if(busy)return;
    setBusy(true);setError('');setResult(null);
    try {setResult(pricingResponse((await axios.post('/api/admin/pricing-preview/',form,{headers:{'X-CSRFToken':getCookie('csrftoken')}})).data));}
    catch(e){setError(readApiError(e));}finally{setBusy(false);}
  };
  return <section className="dk-panel"><h3>Test a price or bulk offer</h3>
    <p>Estimate food contribution from current recipe costs, packaging and the costs you enter. This can be available even when an old order has no recorded batch costs. Nothing here changes live prices or promotions.</p>
    {unavailableReason ? <p role="status">{unavailableReason}</p> : !menus.length ? <p>No menus match this view. Include archived menus to inspect older items, or add a current menu and recipe.</p> : <form className="fyp-form inline" onSubmit={submit}>
      <label>Menu<select required disabled={busy} value={form.product} onChange={e=>{
        const menu=menus.find(m=>String(m.id)===e.target.value);
        setForm({...form,product:e.target.value,price:menu?.price ?? ''});setResult(null);setError('');
      }}><option value="">Choose a menu</option>{menus.map(m=><option key={m.id} value={m.id}>{m.name}{m.selling_status==='archived'?' · Archived':m.selling_status==='paused'?' · Paused':''}</option>)}</select></label>
      {[
        ['portions','Quantity (selling units)',1,10000,1],['price','Scenario price per selling unit (RM)',0.01,99999999.99,0.01],
        ['discount_percent','Scenario discount (%)',0,50,0.1],
        ['ingredient_increase_percent','Ingredient cost increase (%)',0,500,0.1],
        ['additional_cost_per_portion','Other cost per selling unit (RM, both scenarios)',0,99999999.99,0.01],
      ].map(([key,label,min,max,step])=><label key={key}>{label}<input type="number" required disabled={busy} min={min} max={max} step={step} value={form[key]} onChange={e=>change(key,e.target.value)}/></label>)}
      <button disabled={busy}>{busy?'Calculating…':'Compare scenario'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {result && <div aria-live="polite"><h4>{result.menu} · {result.portions} selling units</h4>
      <p>{result.definition}</p>
      <p>Current bulk minimum: {result.current_bulk_minimum} selling units. Scenario ingredient increase: {result.assumptions.ingredient_increase_percent}%. Additional cost per selling unit in both comparisons: {money(result.assumptions.additional_cost_per_portion)}.</p>
      {result.missing.length>0 && <p>Contribution unavailable. Complete: {result.missing.join('; ')}.</p>}
      <div className="guide-results">{[['baseline','Current offer'],['proposed','Your scenario']].map(([key,title])=>{
        const row=result[key];
        return <article key={key}><h4>{title}</h4><p>Price {money(row.price)} · discount {row.discount_percent}%</p>
          <p>Food revenue after discount: {money(row.food_revenue)}</p>
          <p>Ingredient estimate: {money(row.ingredient_cost)} · packaging: {money(row.packaging_cost)} · other costs: {money(row.additional_cost)}</p>
          <p><strong>Estimated contribution: {money(row.contribution)}</strong>{row.margin_percent!==null && ` (${row.margin_percent}%)`}</p>
          <p>Per selling unit: {money(row.per_portion)}. Estimated price to cover entered costs at this discount: {money(row.break_even_price)}.</p>
          {row.below_cost && <p role="status">This offer is below the entered costs.</p>}
        </article>;
      })}</div>
      <p>Estimated contribution change for this order: <strong>{money(result.contribution_change)}</strong>. Recalculate after editing ingredient costs, recipes or promotions.</p>
    </div>}
  </section>;
}
