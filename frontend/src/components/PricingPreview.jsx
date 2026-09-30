import {useState} from 'react';
import axios from 'axios';
import {apiError} from '../utils/apiError';
import {getCookie} from '../utils/cookieUtils';
const money = value => value == null ? 'Unavailable' : `RM ${value}`;

export default function PricingPreview({menus}) {
  const [form,setForm] = useState({product:'', portions:'10', price:'', discount_percent:'0', ingredient_increase_percent:'0', additional_cost_per_portion:'0'});
  const [result,setResult] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const change = (key,value) => {setForm({...form,[key]:value});setResult(null);setError('');};
  const submit = async event => {
    event.preventDefault();if(busy)return;
    setBusy(true);setError('');setResult(null);
    try {setResult((await axios.post('/api/admin/pricing-preview/',form,{headers:{'X-CSRFToken':getCookie('csrftoken')}})).data);}
    catch(e){setError(apiError(e));}finally{setBusy(false);}
  };
  return <section className="dk-panel"><h3>Test a price or bulk offer</h3>
    <p>Compare the current offer with a scenario before changing your menu. Nothing here changes live prices or promotions.</p>
    {!menus.length ? <p>Add a menu and recipe to try pricing scenarios.</p> : <form className="fyp-form inline" onSubmit={submit}>
      <label>Menu<select required disabled={busy} value={form.product} onChange={e=>{
        const menu=menus.find(m=>String(m.id)===e.target.value);
        setForm({...form,product:e.target.value,price:menu?.price ?? ''});setResult(null);setError('');
      }}><option value="">Choose a menu</option>{menus.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {[
        ['portions','Portions',1,10000,1],['price','Scenario price per portion (RM)',0.01,99999999.99,0.01],
        ['discount_percent','Scenario discount (%)',0,50,0.1],
        ['ingredient_increase_percent','Ingredient cost increase (%)',0,500,0.1],
        ['additional_cost_per_portion','Other cost per portion (RM, both scenarios)',0,99999999.99,0.01],
      ].map(([key,label,min,max,step])=><label key={key}>{label}<input type="number" required disabled={busy} min={min} max={max} step={step} value={form[key]} onChange={e=>change(key,e.target.value)}/></label>)}
      <button disabled={busy}>{busy?'Calculating…':'Compare scenario'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {result && <div aria-live="polite"><h4>{result.menu} · {result.portions} portions</h4>
      <p>{result.definition}</p>
      <p>Current bulk minimum: {result.current_bulk_minimum} portions. Scenario ingredient increase: {result.assumptions.ingredient_increase_percent}%. Additional cost per portion in both comparisons: {money(result.assumptions.additional_cost_per_portion)}.</p>
      {result.missing.length>0 && <p>Contribution unavailable. Complete: {result.missing.join('; ')}.</p>}
      <div className="guide-results">{[['baseline','Current offer'],['proposed','Your scenario']].map(([key,title])=>{
        const row=result[key];
        return <article key={key}><h4>{title}</h4><p>Price {money(row.price)} · discount {row.discount_percent}%</p>
          <p>Food revenue after discount: {money(row.food_revenue)}</p>
          <p>Ingredient estimate: {money(row.ingredient_cost)} · packaging: {money(row.packaging_cost)} · other costs: {money(row.additional_cost)}</p>
          <p><strong>Estimated contribution: {money(row.contribution)}</strong> ({row.margin_percent ?? 'unavailable'}%)</p>
          <p>Per portion: {money(row.per_portion)}. Estimated price to cover entered costs at this discount: {money(row.break_even_price)}.</p>
          {row.below_cost && <p role="status">This offer is below the entered costs.</p>}
        </article>;
      })}</div>
      <p>Estimated contribution change for this order: <strong>{money(result.contribution_change)}</strong>. Recalculate after editing ingredient costs, recipes or promotions.</p>
    </div>}
  </section>;
}
