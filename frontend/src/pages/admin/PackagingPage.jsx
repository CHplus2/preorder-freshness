import {useStorefront} from '../../contexts/StorefrontContext';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import axios from 'axios';
import ModalDialog from '../../components/ModalDialog';
import PageLoading from '../../components/PageLoading';
import {useUI} from '../../contexts/UIContext';
import {useAuth} from '../../contexts/AuthContext';
import {packagingRecords,packagingMenus,packagingHistory,packagingChange} from '../../utils/packaging';
import {getCookie} from '../../utils/cookieUtils';
import {apiError,readApiError} from '../../utils/apiError';
import './PackagingPage.css';

const BASE='/api/admin/packaging/';
const config=()=>({withCredentials:true,timeout:20000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
const money=value=>value===null?'Cost not recorded':new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',maximumFractionDigits:6}).format(Number(value));
const initial={name:'',quantity:'',reorder_level:'10',unit_cost:'',is_active:true};
const kinds={opening:'Opening stock',receive:'Received',adjust:'Adjustment',allocate:'Order allocation',release:'Cancellation return'};

function History({item,onClose}) {
 const [before,setBefore]=useState(null),[page,setPage]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get(`${BASE}${item.id}/movements/`,{...config(),timeout:15000,signal:controller.signal,params:before?{before}:undefined})
   .then(({data})=>{const next=packagingHistory(data);if(!controller.signal.aborted){setPage(next);setError('')}})
   .catch(e=>{if(!controller.signal.aborted)setError(readApiError(e,'Could not load stock history.'))});
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
 const [params,setParams]=useSearchParams();
 const requestedId=/^[1-9]\d{0,15}$/.test(params.get('item')||'')&&Number.isSafeInteger(Number(params.get('item')))?Number(params.get('item')):null;
 const clearRequested=()=>setParams(old=>{const next=new URLSearchParams(old);next.delete('item');return next});
 const {isSessionCurrent}=useAuth();
 const simple=useStorefront()?.store?.ordering_mode!=='scheduled';
 const [items,setItems]=useState([]),[menus,setMenus]=useState([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(true),[loadError,setLoadError]=useState('');
 const [tab,setTab]=useState('stock'),[search,setSearch]=useState(''),[filter,setFilter]=useState('current'),[menuFilter,setMenuFilter]=useState('all'),[limit,setLimit]=useState(24);
 const [modal,setModal]=useState(null),[draft,setDraft]=useState(initial),[formError,setFormError]=useState(''),[busy,setBusy]=useState(false);
 const [rows,setRows]=useState([]),[history,setHistory]=useState(null);
 const requestId=useRef(null),inFlight=useRef(false),readController=useRef(null),errorRef=useRef(null);
 const load=useCallback(()=>{
  readController.current?.abort();const controller=new AbortController();readController.current=controller;
  return Promise.all([axios.get(BASE,{...config(),timeout:15000,signal:controller.signal}),axios.get(`${BASE}menus/`,{...config(),timeout:15000,signal:controller.signal})]).then(([stock,products])=>{
   const nextStock=packagingRecords(stock.data),nextMenus=packagingMenus(products.data);
   if(controller.signal.aborted||!isSessionCurrent())return;
   setItems(nextStock);setMenus(nextMenus);setLoadError('');
  }).catch(e=>{if(!controller.signal.aborted&&isSessionCurrent())setLoadError(readApiError(e,'Could not refresh packaging.'))})
  .finally(()=>{if(!controller.signal.aborted&&isSessionCurrent()){setLoading(false);setRefreshing(false)}});
 },[isSessionCurrent]);
 const refresh=useCallback(()=>{setRefreshing(true);return load()},[load]);
 useEffect(()=>{
  load();let timer;
  const onReturn=()=>{if(document.visibilityState==='hidden'||inFlight.current)return;clearTimeout(timer);timer=setTimeout(refresh,150)};
  window.addEventListener('focus',onReturn);document.addEventListener('visibilitychange',onReturn);
  return()=>{clearTimeout(timer);readController.current?.abort();window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn)};
 },[load,refresh]);
 useEffect(()=>{if(formError)errorRef.current?.focus()},[formError]);
 function open(kind,item){
  requestId.current=crypto.randomUUID();setFormError('');setModal({kind,item});
  setDraft(kind==='new'?{...initial}:kind==='adjust'?{direction:'receive',quantity:'',reason:''}:{...item,unit_cost:item?.unit_cost??''});
  setRows(item?.requirements?.map(r=>({...r}))||[]);
 }
 function close(){if(!inFlight.current){setModal(null);setFormError('')}}
 async function save(e){
  e.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setFormError('');
  try{
   const item=modal.item,version=item?.updated_at;
   if(modal.kind==='mapping'){
    if(new Set(rows.map(r=>Number(r.packaging_item))).size!==rows.length)throw new Error('Choose each packaging item once.');
    await axios.put(`${BASE}menus/${item.id}/`,{expected_updated_at:version,requirements:rows.map(r=>({packaging_item:Number(r.packaging_item),quantity_per_item:Number(r.quantity_per_item)}))},config());
   }else if(modal.kind==='adjust'){
    const change=packagingChange(draft.direction,draft.quantity);
    if(item.quantity+change<0)throw new Error('You cannot remove more pieces than the recorded stock.');
    await axios.post(`${BASE}${item.id}/movements/`,{request_id:requestId.current,expected_updated_at:version,change,reason:draft.reason},config());
   }else{
    const data={name:draft.name,reorder_level:Number(draft.reorder_level),unit_cost:draft.unit_cost===''?null:draft.unit_cost,is_active:draft.is_active};
    if(modal.kind==='new')await axios.post(BASE,{...data,quantity:Number(draft.quantity),request_id:requestId.current},config());
    else await axios.patch(`${BASE}${item.id}/`,{...data,expected_updated_at:version},config());
   }
   if(!isSessionCurrent())return;
   if(modal.kind==='new')setFilter('active');
   setModal(null);setAlert({message:modal.kind==='adjust'?'Packaging stock updated.':modal.kind==='mapping'?'Menu packaging saved.':'Packaging saved.',type:'success'});window.dispatchEvent(new Event('inventory-updated'));await load();
  }catch(e){if(isSessionCurrent())setFormError(e.response?e.response.status===409?'This record changed while the form was open. Close the form, refresh records and review the latest stock before trying again.':apiError(e):e.isAxiosError?'The save could not be confirmed. Your entries are kept. Retry the same save or check History before starting another stock change.':e.message);}
  finally{inFlight.current=false;setBusy(false)}
 }
 const currentPackageIds=new Set(menus.filter(menu=>menu.selling_status==='active').flatMap(menu=>menu.requirements.map(row=>row.packaging_item)));
 const visible=items.filter(i=>(!requestedId||i.id===requestedId)&&(!!requestedId||filter==='all'||filter==='current'&&i.is_active&&currentPackageIds.has(i.id)||filter==='low'&&i.low_stock||filter==='active'&&i.is_active)&&i.name.toLowerCase().includes(search.toLowerCase()));
 const visibleMenus=menus.filter(m=>m.selling_status!=='archived'&&(menuFilter!=='unmapped'||m.selling_status==='active'&&!m.requirements.length)&&m.name.toLowerCase().includes(search.toLowerCase()));
 const blocked=busy||refreshing||!!loadError;
 const lowCount=items.filter(i=>i.low_stock).length,unmapped=menus.filter(m=>m.selling_status==='active'&&!m.requirements.length).length;
 const field=e=>setDraft(v=>({...v,[e.target.name]:e.target.type==='checkbox'?e.target.checked:e.target.value}));
 if(loading)return <PageLoading label="Loading packaging stock…"/>;
 return <main className="packaging-page">
  <header className="packaging-heading"><div><p className="packaging-eyebrow">Kitchen stock</p><h1>Packaging</h1><p>Keep containers, lids, bags and labels ready for your orders.</p></div><div className="packaging-actions"><button type="button" disabled={busy||refreshing} onClick={refresh}>{refreshing?'Refreshing…':'Refresh records'}</button><button type="button" className="packaging-primary" disabled={blocked} onClick={()=>open('new')}>Add packaging</button></div></header>
  {loadError&&<div className="packaging-error" role="alert"><p>{loadError} Refresh records before making a stock change.</p><button type="button" disabled={refreshing} onClick={refresh}>Retry loading records</button></div>}
  {params.has('item')&&<div className="packaging-notice" role="status"><p>{requestedId&&items.some(item=>item.id===requestedId)?'Showing the packaging selected in your stock check. Use Update stock to record pieces actually received.':'That packaging record is not available in the current list. Refresh records or review all packaging.'}</p><button type="button" onClick={clearRequested}>Show all packaging</button></div>}
  <div className="packaging-tabs" role="group" aria-label="Packaging views"><button type="button" aria-pressed={tab==='stock'} onClick={()=>{setTab('stock');setSearch('');setLimit(24)}}>Stock <span>{items.filter(i=>i.is_active).length}</span></button><button type="button" aria-pressed={tab==='menus'} onClick={()=>{setTab('menus');setMenuFilter('all');setSearch('');setLimit(24)}}>Menu packaging</button></div>
  {!loadError&&<div className="packaging-overview"><p><strong>{items.filter(i=>i.is_active).length}</strong> active packaging items</p><button type="button" onClick={()=>{setTab('stock');setFilter('low');setSearch('');setLimit(24)}}><strong>{lowCount}</strong> low or out of stock</button><button type="button" onClick={()=>{setTab('menus');setMenuFilter('unmapped');setSearch('');setLimit(24)}}><strong>{unmapped}</strong> active menus without packaging</button></div>}
  <section aria-busy={refreshing} className="packaging-workspace" aria-label={tab==='stock'?'Packaging stock':'Packaging by menu'}>
   <div className="packaging-toolbar"><label>Search {tab==='stock'?'packaging':'menus'}<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(24)}} placeholder={tab==='stock'?'Containers, bags, labels…':'Menu name…'}/></label>{tab==='stock'&&<label>Show<select value={filter} onChange={e=>{setFilter(e.target.value);setLimit(24)}}><option value="current">Used by current menus</option><option value="active">All active stock</option><option value="low">Low stock · {items.filter(i=>i.low_stock).length}</option><option value="all">All, including archived</option></select></label>}{tab==='menus'&&<label>Show<select value={menuFilter} onChange={e=>{setMenuFilter(e.target.value);setLimit(24)}}><option value="all">Current menus</option><option value="unmapped">Active menus without packaging</option></select></label>}</div>
   {tab==='stock'?<>
    <p className="packaging-note">Quantities count individual pieces. {simple?'Packaging is deducted as soon as an order is placed, including unpaid QR and cash orders.':'New confirmed orders deduct the packaging assigned to their menus.'} {!simple&&'Review-only requests do not reserve stock until preparation starts.'}</p>
    <div className="packaging-stock-grid">{visible.slice(0,limit).map(item=><article className="packaging-stock-card" key={item.id}>
     <header><h2>{item.name}</h2>{!item.is_active?<span className="packaging-badge">Archived</span>:item.low_stock?<span className="packaging-badge packaging-low">{item.quantity===0?'Out of stock':'Low stock'}</span>:null}</header>
     <p className="packaging-quantity"><strong>{item.quantity.toLocaleString('en-MY')}</strong> <span>pieces available</span></p>
     <p>{money(item.unit_cost)}{item.unit_cost!==null?' / piece':''} · Reorder at {item.reorder_level}</p><p>Assigned to {item.menu_count} {item.menu_count===1?'menu':'menus'}</p>
     <div className="packaging-actions"><button type="button" disabled={blocked} onClick={()=>open('adjust',item)} aria-label={`Receive or adjust ${item.name}`}>Update stock</button><button type="button" onClick={()=>setHistory(item)} aria-label={`${item.name} stock history`}>History</button><button type="button" disabled={blocked} onClick={()=>open('edit',item)} aria-label={`Edit ${item.name}`}>Edit</button></div>
    </article>)}</div>
    {!loadError&&!visible.length&&<div className="packaging-empty"><h2>{items.length?'No packaging matches this view':'Add your first packaging item'}</h2><p>{items.length?'Try another name or stock filter.':'Start with a container, lid or bag, then assign the pieces needed for each menu.'}</p></div>}
   </>:<>
    <p className="packaging-note">Set the pieces needed for one selling unit: one meal, box or pack. Changes apply to new orders; accepted orders keep their packaging records.</p>
    <ul className="packaging-menu-list">{visibleMenus.slice(0,limit).map(menu=><li key={menu.id}><div><h2>{menu.name}</h2><p>{menu.requirements.length?menu.requirements.map(r=>`${r.quantity_per_item} × ${items.find(i=>i.id===r.packaging_item)?.name||'Packaging item'}`).join(' · '):'No packaging assigned — none will be deducted'}</p></div><button type="button" disabled={blocked} onClick={()=>open('mapping',menu)} aria-label={`Set packaging for ${menu.name}`}>Set packaging</button></li>)}</ul>
    {!loadError&&!visibleMenus.length&&<p>{menuFilter==='unmapped'?'All active menus have packaging assigned, or none match this search.':'No menus match your search.'}</p>}
   </>}
   {(tab==='stock'?visible:visibleMenus).length>limit&&<button className="packaging-more" type="button" onClick={()=>setLimit(v=>v+24)}>Show more {tab==='stock'?'packaging':'menus'}</button>}
  </section>
  {history&&<History item={history} onClose={()=>setHistory(null)}/>}
  {modal&&<ModalDialog label={modal.kind==='mapping'?'Set menu packaging':modal.kind==='adjust'?'Receive or adjust packaging':modal.kind==='new'?'Add packaging':'Edit packaging'} onDismiss={close}><form className="packaging-dialog" onSubmit={save}>
   <header><h2>{modal.kind==='mapping'?modal.item.name:modal.kind==='adjust'?modal.item.name:modal.kind==='new'?'Add packaging':'Edit packaging'}</h2><button type="button" disabled={busy} onClick={close}>Close</button></header>
   <fieldset className="packaging-form-fields" disabled={busy}><legend className="sr-only">Packaging details</legend>
   {modal.kind==='mapping'?<>
    <p>Pieces required for one selling unit of this menu.</p>
    {rows.map((r,index)=><div className="packaging-requirement" key={index}><label>Packaging<select aria-label="Packaging" required value={r.packaging_item} onChange={e=>setRows(v=>v.map((a,i)=>i===index?{...a,packaging_item:e.target.value}:a))}><option value="">Choose packaging</option>{items.filter(i=>(i.is_active||i.id===Number(r.packaging_item))&&!rows.some((other,j)=>j!==index&&Number(other.packaging_item)===i.id)).map(i=><option key={i.id} value={i.id}>{i.name}{!i.is_active?' · archived':''}</option>)}</select></label><label>Pieces<input type="number" required min="1" max="1000" step="1" value={r.quantity_per_item} onChange={e=>setRows(v=>v.map((a,i)=>i===index?{...a,quantity_per_item:e.target.value}:a))}/></label><button type="button" onClick={()=>setRows(v=>v.filter((_,i)=>i!==index))} aria-label={`Remove packaging row ${index+1}`}>Remove</button></div>)}
    {!rows.length&&<p>No packaging will be deducted for this menu.</p>}
    <button type="button" disabled={rows.length>=30||!items.some(i=>i.is_active)} onClick={()=>setRows(v=>[...v,{packaging_item:'',quantity_per_item:1}])}>Add packaging item</button>
   </>:modal.kind==='adjust'?<>
    <p>Currently <strong>{modal.item.quantity} pieces</strong> available.</p><div className="packaging-movement-type" role="group" aria-label="Stock update type">{[['receive','Receive stock'],['remove','Remove stock']].map(([value,label])=><label key={value}><input type="radio" name="direction" value={value} checked={draft.direction===value} onChange={field}/>{label}</label>)}</div>
    <label>{draft.direction==='remove'?'Pieces to remove':'Pieces received'}<input data-initial-focus required type="number" name="quantity" step="1" min="1" max="1000000" value={draft.quantity} onChange={field}/></label>
    <label>Reason<input required maxLength="200" name="reason" value={draft.reason} onChange={field} placeholder={draft.direction==='remove'?'e.g. Damaged containers removed':'e.g. Supplier receipt'}/></label>
    {draft.quantity!==''&&Number.isInteger(Number(draft.quantity))&&Number(draft.quantity)>0&&<p className="packaging-balance-preview">Balance after saving: <strong>{modal.item.quantity+(draft.direction==='remove'?-1:1)*Number(draft.quantity)} pieces</strong></p>}
   </>:<>
    <label>Packaging name<input data-initial-focus required name="name" maxLength="100" value={draft.name} onChange={field} placeholder="e.g. 750 ml meal container"/></label>
    {modal.kind==='new'&&<label>Opening stock (pieces)<input required type="number" name="quantity" min="0" max="1000000" step="1" value={draft.quantity} onChange={field}/></label>}
    <label>Low-stock threshold (pieces)<input required type="number" name="reorder_level" min="0" max="1000000" step="1" value={draft.reorder_level} onChange={field}/></label>
    <label>Cost per piece (RM, optional)<input type="number" name="unit_cost" min="0" max="99999999" step="0.000001" value={draft.unit_cost} onChange={field}/></label>
    {modal.kind==='edit'&&<label className="packaging-check"><input type="checkbox" name="is_active" checked={draft.is_active} onChange={field}/>Available for new orders</label>}
    {modal.kind==='edit'&&<p>Archiving keeps the stock history. Remove archived packaging from menu assignments before accepting new orders.</p>}
   </>}
   </fieldset>
   {formError&&<p ref={errorRef} tabIndex={-1} className="packaging-error" role="alert">{formError}</p>}
   <footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="packaging-primary" disabled={busy} type="submit">{busy?'Saving…':modal.kind==='adjust'?'Save stock change':modal.kind==='mapping'?'Save menu packaging':'Save packaging'}</button></footer>
  </form></ModalDialog>}
 </main>;
}
