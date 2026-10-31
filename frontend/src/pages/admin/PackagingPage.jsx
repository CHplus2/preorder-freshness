import {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import axios from 'axios';
import ModalDialog from '../../components/ModalDialog';
import PageLoading from '../../components/PageLoading';
import {useUI} from '../../contexts/UIContext';
import {getCookie} from '../../utils/cookieUtils';
import {apiError} from '../../utils/apiError';
import './PackagingPage.css';

const BASE='/api/admin/packaging/';
const config=()=>({withCredentials:true,headers:{'X-CSRFToken':getCookie('csrftoken')}});
const money=value=>value===null?'Cost not recorded':new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',maximumFractionDigits:6}).format(Number(value));
const initial={name:'',quantity:'',reorder_level:'10',unit_cost:'',is_active:true};
const kinds={opening:'Opening stock',receive:'Received',adjust:'Adjustment',allocate:'Order allocation',release:'Cancellation return'};

function History({item,onClose}) {
 const [before,setBefore]=useState(null),[page,setPage]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get(`${BASE}${item.id}/movements/`,{...config(),signal:controller.signal,params:before?{before}:undefined})
   .then(({data})=>{if(!Array.isArray(data?.results))throw Error('Invalid history');setPage(data);setError('')})
   .catch(e=>{if(!axios.isCancel(e))setError(apiError(e,'Could not load stock history.'))});
  return()=>controller.abort();
 },[item.id,before,retry]);
 return <ModalDialog label={`${item.name} stock history`} onDismiss={onClose}><section className="packaging-dialog">
  <header><h2>{item.name}</h2><button type="button" onClick={onClose}>Close</button></header>
  <p>Stock history · newest movements first</p>
  {error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(v=>v+1)}>Try again</button></div>:!page?<p role="status">Loading history…</p>:<>
   <div className="packaging-history"><table><thead><tr><th scope="col">When · Malaysia</th><th scope="col">Movement</th><th scope="col">Change</th><th scope="col">Balance</th></tr></thead><tbody>{page.results.map(row=><tr key={row.id}>
    <td>{new Date(row.created_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})}</td>
    <td>{kinds[row.kind]||row.kind}<small>{row.reason}</small>{row.order_id&&<Link to={`/admin/orders?order=${row.order_id}`}>View order #{row.order_id}</Link>}</td>
    <td>{row.change>0?'+':''}{row.change}</td><td>{row.balance_after}</td>
   </tr>)}</tbody></table></div>
   {!page.results.length&&<p>No stock movements recorded.</p>}
   <div className="packaging-actions">{before&&<button type="button" onClick={()=>{setPage(null);setBefore(null)}}>Newest movements</button>}{page.next_before&&<button type="button" onClick={()=>{setPage(null);setBefore(page.next_before)}}>Older movements</button>}</div>
  </>}
 </section></ModalDialog>;
}

export default function PackagingPage(){
 const {setAlert}=useUI();
 const [items,setItems]=useState([]),[menus,setMenus]=useState([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [tab,setTab]=useState('stock'),[search,setSearch]=useState(''),[filter,setFilter]=useState('active');
 const [modal,setModal]=useState(null),[draft,setDraft]=useState(initial),[formError,setFormError]=useState(''),[busy,setBusy]=useState(false);
 const [rows,setRows]=useState([]),[history,setHistory]=useState(null);
 const requestId=useRef(null),inFlight=useRef(false);
 const load=useCallback(signal=>Promise.all([
  axios.get(BASE,{...config(),signal}),axios.get(`${BASE}menus/`,{...config(),signal})
 ]).then(([stock,products])=>{
  if(!Array.isArray(stock.data)||!Array.isArray(products.data))throw Error('Invalid packaging data');
  setItems(stock.data);setMenus(products.data);setLoadError('');
 }).catch(e=>{if(!axios.isCancel(e))setLoadError(apiError(e,'Could not refresh packaging. Your last displayed records may be out of date.'))})
 .finally(()=>{if(!signal?.aborted)setLoading(false)}),[]);
 useEffect(()=>{const controller=new AbortController();load(controller.signal);return()=>controller.abort()},[load]);
 function open(kind,item){
  requestId.current=crypto.randomUUID();setFormError('');setModal({kind,item});
  setDraft(kind==='new'?{...initial}:kind==='adjust'?{change:'',reason:''}:{...item,unit_cost:item?.unit_cost??''});
  setRows(item?.requirements?.map(r=>({...r}))||[]);
 }
 function close(){if(!inFlight.current){setModal(null);setFormError('')}}
 async function save(e){
  e.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setFormError('');
  try{
   const item=modal.item,version=item?.updated_at;
   if(modal.kind==='mapping'){
    await axios.put(`${BASE}menus/${item.id}/`,{expected_updated_at:version,requirements:rows.map(r=>({packaging_item:Number(r.packaging_item),quantity_per_item:Number(r.quantity_per_item)}))},config());
   }else if(modal.kind==='adjust'){
    await axios.post(`${BASE}${item.id}/movements/`,{request_id:requestId.current,expected_updated_at:version,change:Number(draft.change),reason:draft.reason},config());
   }else{
    const data={name:draft.name,reorder_level:Number(draft.reorder_level),unit_cost:draft.unit_cost===''?null:draft.unit_cost,is_active:draft.is_active};
    if(modal.kind==='new')await axios.post(BASE,{...data,quantity:Number(draft.quantity),request_id:requestId.current},config());
    else await axios.patch(`${BASE}${item.id}/`,{...data,expected_updated_at:version},config());
   }
   setModal(null);setAlert({message:'Packaging saved.',type:'success'});await load();
  }catch(e){setFormError(apiError(e,'The save could not be confirmed. Your entries have been kept. Refresh stock records before starting a new adjustment.'));}
  finally{inFlight.current=false;setBusy(false)}
 }
 const visible=items.filter(i=>(filter==='all'||filter==='low'&&i.low_stock||filter==='active'&&i.is_active)&&i.name.toLowerCase().includes(search.toLowerCase()));
 const visibleMenus=menus.filter(m=>m.selling_status!=='archived'&&m.name.toLowerCase().includes(search.toLowerCase()));
 const field=e=>setDraft(v=>({...v,[e.target.name]:e.target.type==='checkbox'?e.target.checked:e.target.value}));
 if(loading)return <PageLoading label="Loading packaging stock…"/>;
 return <main className="packaging-page">
  <header className="packaging-heading"><div><p className="packaging-eyebrow">Kitchen stock</p><h1>Packaging</h1><p>Keep containers, lids, bags and labels ready for your orders.</p></div><div className="packaging-actions"><button type="button" disabled={busy} onClick={()=>load()}>Refresh</button><button type="button" className="packaging-primary" onClick={()=>open('new')}>Add packaging</button></div></header>
  {loadError&&<p className="packaging-error" role="alert">{loadError}</p>}
  <div className="packaging-tabs" role="group" aria-label="Packaging views"><button type="button" aria-pressed={tab==='stock'} onClick={()=>{setTab('stock');setSearch('')}}>Stock <span>{items.filter(i=>i.is_active).length}</span></button><button type="button" aria-pressed={tab==='menus'} onClick={()=>{setTab('menus');setSearch('')}}>Menu packaging</button></div>
  <section className="packaging-workspace" aria-label={tab==='stock'?'Packaging stock':'Packaging by menu'}>
   <div className="packaging-toolbar"><label>Search {tab==='stock'?'packaging':'menus'}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='stock'?'Containers, bags, labels…':'Menu name…'}/></label>{tab==='stock'&&<label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Active stock</option><option value="low">Low stock · {items.filter(i=>i.low_stock).length}</option><option value="all">All, including archived</option></select></label>}</div>
   {tab==='stock'?<>
    <p className="packaging-note">Quantities count individual pieces. New confirmed orders deduct the packaging assigned to their menus. Review-only requests do not reserve stock until preparation starts.</p>
    <div className="packaging-stock-grid">{visible.map(item=><article className="packaging-stock-card" key={item.id}>
     <header><h2>{item.name}</h2>{!item.is_active?<span className="packaging-badge">Archived</span>:item.low_stock?<span className="packaging-badge packaging-low">{item.quantity===0?'Out of stock':'Low stock'}</span>:null}</header>
     <p className="packaging-quantity"><strong>{item.quantity.toLocaleString('en-MY')}</strong> <span>pieces available</span></p>
     <p>{money(item.unit_cost)}{item.unit_cost!==null?' / piece':''} · Reorder at {item.reorder_level}</p><p>Assigned to {item.menu_count} {item.menu_count===1?'menu':'menus'}</p>
     <div className="packaging-actions"><button type="button" onClick={()=>open('adjust',item)} aria-label={`Receive or adjust ${item.name}`}>Receive / adjust</button><button type="button" onClick={()=>setHistory(item)} aria-label={`${item.name} stock history`}>History</button><button type="button" onClick={()=>open('edit',item)} aria-label={`Edit ${item.name}`}>Edit</button></div>
    </article>)}</div>
    {!visible.length&&<div className="packaging-empty"><h2>{items.length?'No packaging matches this view':'Add your first packaging item'}</h2><p>{items.length?'Try another name or stock filter.':'Start with a container, lid or bag, then assign the pieces needed for each menu.'}</p></div>}
   </>:<>
    <p className="packaging-note">Set the pieces needed for one selling unit: one meal, box or pack. Changes apply to new orders; accepted orders keep their packaging records.</p>
    <ul className="packaging-menu-list">{visibleMenus.map(menu=><li key={menu.id}><div><h2>{menu.name}</h2><p>{menu.requirements.length?menu.requirements.map(r=>`${r.quantity_per_item} × ${items.find(i=>i.id===r.packaging_item)?.name||'Packaging item'}`).join(' · '):'No packaging assigned'}</p></div><button type="button" onClick={()=>open('mapping',menu)} aria-label={`Set packaging for ${menu.name}`}>Set packaging</button></li>)}</ul>
    {!visibleMenus.length&&<p>No active menus match your search.</p>}
   </>}
  </section>
  {history&&<History item={history} onClose={()=>setHistory(null)}/>}
  {modal&&<ModalDialog label={modal.kind==='mapping'?'Set menu packaging':modal.kind==='adjust'?'Receive or adjust packaging':modal.kind==='new'?'Add packaging':'Edit packaging'} onDismiss={close}><form className="packaging-dialog" onSubmit={save}>
   <header><h2>{modal.kind==='mapping'?modal.item.name:modal.kind==='adjust'?modal.item.name:modal.kind==='new'?'Add packaging':'Edit packaging'}</h2><button type="button" disabled={busy} onClick={close}>Close</button></header>
   {modal.kind==='mapping'?<>
    <p>Pieces required for one selling unit of this menu.</p>
    {rows.map((r,index)=><div className="packaging-requirement" key={index}><label>Packaging<select aria-label="Packaging" required value={r.packaging_item} onChange={e=>setRows(v=>v.map((a,i)=>i===index?{...a,packaging_item:e.target.value}:a))}><option value="">Choose packaging</option>{items.filter(i=>i.is_active||i.id===Number(r.packaging_item)).map(i=><option key={i.id} value={i.id}>{i.name}{!i.is_active?' · archived':''}</option>)}</select></label><label>Pieces<input type="number" required min="1" max="1000" step="1" value={r.quantity_per_item} onChange={e=>setRows(v=>v.map((a,i)=>i===index?{...a,quantity_per_item:e.target.value}:a))}/></label><button type="button" onClick={()=>setRows(v=>v.filter((_,i)=>i!==index))} aria-label={`Remove packaging row ${index+1}`}>Remove</button></div>)}
    {!rows.length&&<p>No packaging will be deducted for this menu.</p>}
    <button type="button" disabled={rows.length>=30||!items.some(i=>i.is_active)} onClick={()=>setRows(v=>[...v,{packaging_item:'',quantity_per_item:1}])}>Add packaging item</button>
   </>:modal.kind==='adjust'?<>
    <p>Currently {modal.item.quantity} pieces available. Use a positive number for received stock, or a negative number for a correction.</p>
    <label>Stock change (pieces)<input data-initial-focus required type="number" name="change" step="1" min="-1000000" max="1000000" value={draft.change} onChange={field}/></label>
    <label>Reason<input required maxLength="200" name="reason" value={draft.reason} onChange={field} placeholder="e.g. Received 100 containers from supplier"/></label>
    {draft.change!==''&&Number.isInteger(Number(draft.change))&&<p>After adjustment: <strong>{modal.item.quantity+Number(draft.change)} pieces</strong></p>}
   </>:<>
    <label>Packaging name<input data-initial-focus required name="name" maxLength="100" value={draft.name} onChange={field} placeholder="e.g. 750 ml meal container"/></label>
    {modal.kind==='new'&&<label>Opening stock (pieces)<input required type="number" name="quantity" min="0" max="1000000" step="1" value={draft.quantity} onChange={field}/></label>}
    <label>Low-stock threshold (pieces)<input required type="number" name="reorder_level" min="0" max="1000000" step="1" value={draft.reorder_level} onChange={field}/></label>
    <label>Cost per piece (RM, optional)<input type="number" name="unit_cost" min="0" max="99999999" step="0.000001" value={draft.unit_cost} onChange={field}/></label>
    {modal.kind==='edit'&&<label className="packaging-check"><input type="checkbox" name="is_active" checked={draft.is_active} onChange={field}/>Available for new orders</label>}
    {modal.kind==='edit'&&<p>Archiving keeps the stock history. Remove archived packaging from menu assignments before accepting new orders.</p>}
   </>}
   {formError&&<p className="packaging-error" role="alert">{formError}</p>}
   <footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="packaging-primary" disabled={busy} type="submit">{busy?'Saving…':modal.kind==='adjust'?'Save stock change':modal.kind==='mapping'?'Save menu packaging':'Save packaging'}</button></footer>
  </form></ModalDialog>}
 </main>;
}
