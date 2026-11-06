import {useEffect,useState,useRef} from 'react';
import axios from 'axios';
import {Link} from 'react-router-dom';
import {apiError,readApiError} from '../utils/apiError';
import {getCookie} from '../utils/cookieUtils';
import {malaysiaDate} from '../utils/planner';
import {stockQuantity} from '../utils/stockShortage';
import {costReport,costMaterials,costLots,costExpenses,costMenuSelection} from '../utils/costResponse';
import PricingPreview from './PricingPreview';
import CostAssumptions from './CostAssumptions';
import useOrderCatalogue from '../hooks/useOrderCatalogue';
const money=value=>value==null?'Not recorded':'RM '+Number(value).toFixed(2);
const categories={utilities:'Utilities',delivery:'Courier & transport',labour:'Labour',marketing:'Marketing',other:'Other overhead'};

export default function CostPanel(){
 const [report,setReport]=useState(null),[materials,setMaterials]=useState([]),[lots,setLots]=useState([]),[expenses,setExpenses]=useState([]);
 const [includeArchived,setIncludeArchived]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const {catalogue,error:catalogueError}=useOrderCatalogue(retry);
 const [range,setRange]=useState(()=>({start:malaysiaDate(new Date(Date.now()-27*86400000)),end:malaysiaDate(new Date())}));
 const [applied,setApplied]=useState(range);
 const [expense,setExpense]=useState({date:malaysiaDate(new Date()),category:'utilities',amount:'',note:''});
 const [waste,setWaste]=useState({inventory_item:'',quantity:'',reason:''}),[reviewWaste,setReviewWaste]=useState(false),[voiding,setVoiding]=useState(null);
 const expenseKey=useRef(crypto.randomUUID()),wasteKey=useRef(crypto.randomUUID()),feedback=useRef(null);
 useEffect(()=>{if(error){feedback.current?.focus({preventScroll:true})}},[error]);
 useEffect(()=>{
  const controller=new AbortController();
  Promise.all([
   axios.get('/api/admin/costs/',{params:applied,signal:controller.signal}),
   axios.get('/api/admin/raw-materials/',{signal:controller.signal}),
   axios.get('/api/admin/inventory-items/',{signal:controller.signal}),
   axios.get('/api/admin/expenses/',{signal:controller.signal}),
  ]).then(([a,b,d,e])=>{
   const next={report:costReport(a.data),materials:costMaterials(b.data),lots:costLots(d.data),expenses:costExpenses(e.data)};
   if(controller.signal.aborted)return;
   setReport(next.report);setMaterials(next.materials);setLots(next.lots);setExpenses(next.expenses);
  }).catch(error=>{if(!controller.signal.aborted)setError(readApiError(error))})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[applied,retry]);
 const refresh=()=>{setError('');setLoading(true);setRetry(value=>value+1)};
 const mutate=async(url,data,method='post',notice='Record saved.')=>{
  if(busy||loading)return false;
  setBusy(true);setError('');setMessage('');
  try{
   await axios[method](url,data,{headers:{'X-CSRFToken':getCookie('csrftoken')}});
   setLoading(true);setRetry(value=>value+1);setMessage(notice);return true;
  }catch(error){setError(apiError(error));return false}finally{setBusy(false)}
 };
 const disabled=busy||loading;
 const visibleMenus=report&&catalogue?costMenuSelection(report.menus,catalogue,includeArchived):[];
 const selectedLot=lots.find(lot=>String(lot.id)===String(waste.inventory_item));
 const wasteValid=selectedLot&&Number(waste.quantity)>0&&Number(waste.quantity)<=Number(selectedLot.quantity)&&waste.reason.trim();
 return <section id="costs" tabIndex={-1} className="cost-workspace" aria-busy={loading}>
  <header className="sales-panel-heading"><div><h2>Costs & pricing</h2><p>Compare current menu costs. Keep expenses and discarded stock recorded when you need them.</p></div><button type="button" disabled={disabled} onClick={refresh}>{loading?'Refreshing…':'Refresh costs'}</button></header>
  <form className="sales-date-filter" onSubmit={event=>{event.preventDefault();setError('');setLoading(true);setApplied({...range});setRetry(value=>value+1)}}>
   <label>Expenses & wastage from<input type="date" required value={range.start} max={range.end} onChange={event=>setRange({...range,start:event.target.value})}/></label>
   <label>To<input type="date" required value={range.end} min={range.start} onChange={event=>setRange({...range,end:event.target.value})}/></label><button disabled={disabled}>Apply dates</button>
  </form>
  {(error||message)&&<div ref={feedback} tabIndex={-1} role={error?'alert':'status'} className={error?'cost-feedback cost-feedback--error':'cost-feedback'}><p>{error||message}</p>{error&&<button type="button" disabled={disabled} onClick={refresh}>Try loading again</button>}</div>}
  {!report&&!error&&<p role="status">Loading cost records…</p>}
  {report&&<>
   <div className="cost-summary-grid"><article><span>Operating expenses</span><strong>{money(report.operating_expenses)}</strong><small>{report.start} to {report.end}</small></article><article><span>Recorded wastage cost</span><strong>{money(report.known_waste_cost)}</strong><small>{report.unpriced_waste_records?`${report.unpriced_waste_records} entries have no recorded purchase cost; total is incomplete.`:'From discarded ingredients in this period.'}</small></article></div>
   <p className="cost-scope-note">The dates filter expenses and wastage. Pricing tools below use current recipes and cost estimates.</p>
   {catalogueError&&<p role="alert">Menus could not be loaded. <button type="button" onClick={refresh}>Try again</button></p>}
   <PricingPreview key={`${retry}:${includeArchived}`} menus={visibleMenus} unavailableReason={catalogueError?'Load the menu list before comparing prices.':!catalogue?'Loading menus…':''}/>
   <details className="cost-section"><summary><span>Current recipe estimates</span><small>{visibleMenus.length} menus · food costs per selling unit</small></summary><div className="cost-section-body">
    <p>Menu price minus ingredient and packaging costs. Delivery, labour and overhead are excluded, so this is not net profit.</p>
    <label className="cost-inline-check"><input type="checkbox" checked={includeArchived} onChange={event=>setIncludeArchived(event.target.checked)}/>Include archived menus</label>
    <div className="cost-menu-grid">{visibleMenus.map(menu=><article key={menu.id}><h3>{menu.name}{menu.selling_status==='archived'?' · Archived':menu.selling_status==='paused'?' · Paused':''}</h3><dl><div><dt>Menu price</dt><dd>{money(menu.price)}</dd></div><div><dt>Ingredients</dt><dd>{money(menu.ingredient_cost)}</dd></div><div><dt>Packaging</dt><dd>{money(menu.packaging_cost)}</dd></div></dl>{menu.missing.length?<p className="cost-incomplete">Estimate unavailable. Add missing costs: {menu.missing.join('; ')}.</p>:<p><strong>{money(menu.estimated_contribution)}</strong> food contribution per unit{menu.estimated_margin_percent!==null&&` (${menu.estimated_margin_percent}%)`}.</p>}</article>)}</div>
    {!visibleMenus.length&&<p>No menus in this view.</p>}<p><Link to="/admin/packaging">Edit assigned packaging costs</Link> · <Link to="/admin/products">Review menu recipes</Link></p>
   </div></details>
   <CostAssumptions materials={materials} busy={disabled} onSave={(id,cost)=>mutate(`/api/admin/raw-materials/${id}/`,{estimated_unit_cost:cost},'patch','Ingredient cost saved.')}/>
   <div className="cost-record-grid">
    <details className="cost-section" id="expense-form"><summary><span>Record an expense</span><small>Utilities, courier fees, labour or marketing</small></summary><div className="cost-section-body">
     <p>Record business spending here. Ingredient and packaging purchases belong in their stock records; recording them twice would overstate costs.</p>
     <form className="cost-entry-form" onSubmit={async event=>{event.preventDefault();if(await mutate('/api/admin/expenses/',{...expense,request_id:expenseKey.current},'post','Expense recorded.')){expenseKey.current=crypto.randomUUID();setExpense({...expense,amount:'',note:''})}}}>
      <fieldset disabled={disabled}><legend className="sr-only">Expense details</legend><div className="cost-form-grid">
       <label>Date<input type="date" required max={malaysiaDate(new Date())} value={expense.date} onChange={event=>setExpense({...expense,date:event.target.value})}/></label>
       <label>Category<select value={expense.category} onChange={event=>setExpense({...expense,category:event.target.value})}>{Object.entries(categories).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
       <label>Amount (RM)<input type="number" required min="0.01" step="0.01" value={expense.amount} onChange={event=>setExpense({...expense,amount:event.target.value})}/></label>
       <label>Receipt reference or description<input required maxLength={300} value={expense.note} onChange={event=>setExpense({...expense,note:event.target.value})}/></label>
      </div><button>Save expense</button></fieldset>
     </form>
    </div></details>
    <details className="cost-section" id="waste-form"><summary><span>Record ingredient wastage</span><small>Discarded ingredients · reduces batch stock</small></summary><div className="cost-section-body">
     <p>Use this when ingredients are discarded. Food already allocated to an order has been deducted; do not record it again here.</p>
     <form className="cost-entry-form" onSubmit={async event=>{
      event.preventDefault();if(!wasteValid)return;if(!reviewWaste){setReviewWaste(true);return}
      if(await mutate('/api/admin/waste/',{...waste,request_id:wasteKey.current},'post','Wastage recorded and stock deducted.')){wasteKey.current=crypto.randomUUID();setWaste({inventory_item:'',quantity:'',reason:''});setReviewWaste(false)}
     }}>
      <fieldset disabled={disabled||reviewWaste}><legend className="sr-only">Wastage details</legend>
       <label>Ingredient batch<select required value={waste.inventory_item} onChange={event=>setWaste({...waste,inventory_item:event.target.value,quantity:''})}><option value="">Choose a batch</option>{lots.filter(lot=>Number(lot.quantity)>0).map(lot=><option key={lot.id} value={lot.id}>{lot.raw_material_name} · {lot.batch_code||'#'+lot.id} · {stockQuantity(lot.quantity)} {lot.unit}</option>)}</select></label>
       <div className="cost-form-grid"><label>Quantity to discard{selectedLot?` (${selectedLot.unit})`:''}<input type="number" required min="0.001" step="0.001" max={selectedLot?.quantity} value={waste.quantity} onChange={event=>setWaste({...waste,quantity:event.target.value})}/></label><label>Reason<input required maxLength={300} placeholder="For example, damaged or spoiled" value={waste.reason} onChange={event=>setWaste({...waste,reason:event.target.value})}/></label></div>
      </fieldset>
      {reviewWaste?<div className="cost-review" role="group" aria-label="Confirm wastage deduction"><h3>Review stock deduction</h3>{selectedLot&&<><p>Discard <strong>{stockQuantity(waste.quantity)} {selectedLot.unit} of {selectedLot.raw_material_name}</strong> from {selectedLot.batch_code||'batch #'+selectedLot.id}.</p><p>Remaining: {stockQuantity(Math.max(0,Number(selectedLot.quantity)-Number(waste.quantity)))} {selectedLot.unit}. Reason: {waste.reason}.</p></>}{!wasteValid&&<p role="alert">The batch or available quantity changed. Go back and review it before saving.</p>}<div className="cost-form-actions"><button type="button" disabled={disabled} onClick={()=>setReviewWaste(false)}>Go back</button><button type="submit" disabled={disabled||!wasteValid}>Confirm &amp; deduct stock</button></div></div>:<button type="submit" disabled={disabled||!wasteValid}>Review wastage</button>}
     </form>
    </div></details>
   </div>
   <details className="cost-section"><summary><span>Expense history</span><small>Latest 100 entries · all dates</small></summary><div className="cost-section-body">
    {!expenses.length&&<p>No expenses recorded yet.</p>}{expenses.map(entry=><article className="cost-ledger-row" key={entry.id}><div><strong>{categories[entry.category]||entry.category} · {money(entry.amount)}</strong><p>{entry.date} · {entry.note}</p></div>{entry.voided?<span>Voided · excluded from totals</span>:voiding===entry.id?<div className="cost-review"><p>Exclude this expense from totals? The original entry will remain in the history.</p><div className="cost-form-actions"><button type="button" disabled={disabled} onClick={()=>setVoiding(null)}>Go back</button><button type="button" disabled={disabled} onClick={async()=>{if(await mutate(`/api/admin/expenses/${entry.id}/void/`,{},'post','Expense voided.'))setVoiding(null)}}>Confirm void</button></div></div>:<button type="button" disabled={disabled} onClick={()=>setVoiding(entry.id)}>Void entry</button>}</article>)}
   </div></details>
   <details className="cost-section"><summary><span>Wastage history</span><small>{report.start} to {report.end} · latest 100 entries</small></summary><div className="cost-section-body">{!report.waste.length&&<p>No wastage recorded in this period.</p>}{report.waste.map(entry=><article className="cost-ledger-row" key={entry.id}><div><strong>{entry.material} · {stockQuantity(entry.quantity)} {entry.unit}</strong><p>{entry.date} · {entry.reason}</p></div><span>{money(entry.cost)}</span></article>)}</div></details>
  </>}
 </section>;
}
