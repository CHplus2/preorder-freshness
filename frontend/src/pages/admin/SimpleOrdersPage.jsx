import {DailyOrderReport} from '../../components/ClientReports';
import {dailyOrdersUrl,summaryDay,validReportDay,orderCustomerName,undatedOpenOrder,matchesOrderSearch} from '../../utils/operationalOrders';
import {validReceiptUpdate} from '../../utils/simpleOrdering';
import {slipUrl} from '../../utils/clientReports';
import {Link} from 'react-router-dom';
import CourierHandover from '../../components/CourierHandover';
import {useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import axios from 'axios';
import {useOrder} from '../../contexts/OrderContext';
import {useUI} from '../../contexts/UIContext';
import {getCookie} from '../../utils/cookieUtils';
import {apiError} from '../../utils/apiError';
import {closedGeneratedHistory,orderDate} from '../../utils/orderPresentation';
import {arrivalLabel} from '../../utils/arrivalWindow';
import {quantityLabel} from '../../utils/sellingDetails';
import ModalDialog from '../../components/ModalDialog';
import OrderFulfilment from '../../components/OrderFulfilment';
import OrderContactActions from '../../components/OrderContactActions';
import PaymentRecords from '../../components/PaymentRecords';
import SimpleDeliveryChange from '../../components/SimpleDeliveryChange';
import './SimpleOrdersPage.css';

const config=()=>({headers:{'X-CSRFToken':getCookie('csrftoken')}});
export default function SimpleOrdersPage(){
 const [params,setParams]=useSearchParams();const daily=params.get('view')==='daily',day=summaryDay(params.get('date'));
 return <main className="simple-orders"><header><div><p className="simple-orders-eyebrow">Kitchen orders</p><h1>Orders</h1><p>{daily?'Review menu quantities and preview customer slips for one day.':'Confirm receipt after the customer has their food. Payments are recorded separately.'}</p></div><Link className="order-workspace-link" to="/admin/reports#period-sales">Sales report</Link></header>
  <nav className="order-workspace-nav" aria-label="Orders workspace"><Link to="/admin/orders" aria-current={!daily?'page':undefined}>Order queue</Link><Link to={dailyOrdersUrl(day)} aria-current={daily?'page':undefined}>Daily summary</Link></nav>
  {daily?<DailyOrderReport key={day} initialDate={day} onDateChange={date=>setParams({view:'daily',date})}/>:<SimpleOrderQueue key={params.toString()}/>}
 </main>;
}
function SimpleOrderQueue(){
 const [params]=useSearchParams();
 const {adminOrders,fetchAdminOrders,adminOrdersLoading,adminOrdersError}=useOrder();
 const {formatOrderNumber,setAlert}=useUI();
 useEffect(()=>{fetchAdminOrders()},[fetchAdminOrders]);
 const [status,setStatus]=useState(params.get('order')?'all':'not_received'),[date,setDate]=useState(()=>params.get('review')!=='missing-delivery'&&validReportDay(params.get('date'))?params.get('date'):''),[search,setSearch]=useState(()=>/^\d+$/.test(params.get('order')||'')?formatOrderNumber(Number(params.get('order'))):''),[limit,setLimit]=useState(12);
 const [selected,setSelected]=useState([]),[modal,setModal]=useState(null),[reason,setReason]=useState(''),[returnStock,setReturnStock]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[payment,setPayment]=useState(null);
 const active=useRef(false);
 const missingOnly=params.get('review')==='missing-delivery';
 const actual=adminOrders.filter(o=>!closedGeneratedHistory(o));
 const missing=actual.filter(undatedOpenOrder).length;
 const list=actual.filter(o=>(!missingOnly||undatedOpenOrder(o))&&(status==='all'||status==='cancelled'&&o.status==='cancelled'||status==='received'&&o.status==='delivered'||status==='not_received'&&!['delivered','cancelled'].includes(o.status))&&(!date||(o.delivery_at&&new Date(Date.parse(o.delivery_at)+8*3600000).toISOString().slice(0,10)===date))&&matchesOrderSearch(o,search,formatOrderNumber(o.id))).sort((a,b)=>Date.parse(a.delivery_at||a.created_at)-Date.parse(b.delivery_at||b.created_at));
 const visible=list.slice(0,limit);
 const open=(kind,order)=>{setError('');setReason('');setReturnStock(false);setModal({kind,order})};
 const save=async e=>{
  e?.preventDefault();if(active.current)return;active.current=true;setBusy(true);setError('');
  try{
   if(modal?.kind==='cancel')await axios.post(`/api/admin/orders/${modal.order.id}/cancel/`,{version:modal.order.updated_at,reason,return_unused_stock:returnStock},config());
   else{
    const rows=modal?.order?[modal.order]:visible.filter(o=>selected.includes(o.id));
    const {data}=await axios.post('/api/admin/orders/receipts/',{received:modal?.kind!=='correct',reason,orders:rows.map(o=>({id:o.id,version:o.updated_at}))},config());
    if(!validReceiptUpdate(data,rows.map(o=>o.id),modal?.kind!=='correct'))throw new Error('Unexpected receipt confirmation. Refresh the order list.');
   }
   setModal(null);setSelected([]);setAlert({message:'Order records updated.',type:'success'});await fetchAdminOrders();
  }catch(e){setError(apiError(e))}finally{active.current=false;setBusy(false)}
 };
 return <>
  <div className="simple-orders-queue-tools"><button type="button" disabled={busy||adminOrdersLoading} onClick={()=>{setSelected([]);fetchAdminOrders()}}>Refresh orders</button></div>
  {!adminOrdersLoading&&!adminOrdersError&&missing>0&&<div className="undated-orders-note"><p>{missing} open {missing===1?'order has':'orders have'} no delivery or collection date. These are excluded from daily summaries until a time is agreed.</p>{missingOnly?<Link to="/admin/orders">Show all open orders</Link>:<Link to="/admin/orders?review=missing-delivery">Review orders without dates</Link>}</div>}
  {adminOrdersError&&<p role="alert" className="simple-orders-error">{adminOrdersError}</p>}
  {!missingOnly&&<div className="simple-orders-tabs" role="group" aria-label="Order view">{[['not_received','Not received'],['received','Received'],['cancelled','Cancelled'],['all','All orders']].map(([key,label])=><button type="button" aria-pressed={status===key} key={key} onClick={()=>{setStatus(key);setSelected([]);setLimit(12)}}>{label}</button>)}</div>}
  <div className="simple-orders-filters"><label>Search orders<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setSelected([]);setLimit(12)}} placeholder="Order number, name or menu"/></label>{!missingOnly&&<label>Delivery / collection date<input type="date" value={date} onChange={e=>{setDate(e.target.value);setSelected([]);setLimit(12)}}/></label>}{date&&<button type="button" onClick={()=>{setDate('');setSelected([])}}>Clear date</button>}</div>
  {selected.length>0&&<div className="simple-orders-selection"><p>{selected.length} selected · confirm actual receipt for every selected order</p><button type="button" disabled={busy} onClick={()=>open('batch',null)}>Mark selected received</button><button type="button" disabled={busy} onClick={()=>setSelected([])}>Clear selection</button></div>}
  {adminOrdersLoading&&<p role="status">Refreshing orders…</p>}
  <p>{list.length} {list.length===1?'order':'orders'} in this view · <Link to={dailyOrdersUrl(date)}>Daily summary</Link></p>
  {!adminOrdersLoading&&!list.length&&<div className="simple-orders-empty"><h2>No orders in this view</h2><p>Try another date, search or receipt status.</p></div>}
  <div className="simple-orders-list">{visible.map(order=><article key={order.id} aria-label={`Order ${formatOrderNumber(order.id)}`}>
   <header><div><h2>Order #{formatOrderNumber(order.id)}</h2><p>{orderCustomerName(order)}</p></div><span className={'simple-receipt-badge '+(order.status==='delivered'?'received':'')}>{order.status==='cancelled'?'Cancelled':order.status==='delivered'?'Received':'Not received'}</span></header>
   <dl><div><dt>{order.delivery_method==='pickup'?'Self-collection':'Delivery'}</dt><dd>{arrivalLabel(order)}</dd></div><div><dt>Placed</dt><dd>{orderDate(order.created_at)}</dd></div></dl>
   <ul className="simple-order-items">{order.items.map(item=><li key={item.id}><span>{item.product_name}</span><strong>{quantityLabel(item.selling_details,item.quantity)}</strong></li>)}</ul>
   <p className="simple-order-total">RM {(Number(order.total_amount)+Number(order.shipping_fee)).toFixed(2)} <span>Payment: {order.payment_status}</span></p>
   <div className="simple-order-actions">{!['delivered','cancelled'].includes(order.status)&&<><label className="simple-order-select"><input type="checkbox" checked={selected.includes(order.id)} disabled={!selected.includes(order.id)&&selected.length>=20} onChange={e=>setSelected(v=>e.target.checked?[...v,order.id]:v.filter(id=>id!==order.id))}/>Select for receipt</label><button type="button" disabled={busy||adminOrdersLoading} onClick={()=>open('receive',order)}>Mark received</button><button type="button" disabled={busy||adminOrdersLoading} onClick={()=>open('cancel',order)}>Cancel order</button></>}{order.status==='delivered'&&<button type="button" disabled={busy||adminOrdersLoading} onClick={()=>open('correct',order)}>Correct receipt status</button>}<button type="button" onClick={()=>setPayment(v=>v===order.id?null:order.id)}>Payment records</button></div>
   <p><a href={slipUrl(order.id)} target="_blank" rel="noopener noreferrer">Preview &amp; print</a></p>
   <details><summary>Contact & handover</summary><OrderFulfilment order={order} owner/><OrderContactActions order={order}/><CourierHandover order={order} onSaved={fetchAdminOrders}/></details>
   <SimpleDeliveryChange key={order.id+order.updated_at} order={order} owner onSaved={fetchAdminOrders}/>
   {payment===order.id&&<PaymentRecords order={order} onSaved={fetchAdminOrders}/>}
  </article>)}</div>
  {list.length>limit&&<button type="button" onClick={()=>setLimit(v=>v+12)}>Show more orders</button>}
  {modal&&<ModalDialog label="Confirm order update" onDismiss={()=>{if(!busy)setModal(null)}}><div className="modal-overlay"><form className="modal-content simple-order-dialog" onSubmit={save}>
   <h2>{modal.kind==='cancel'?'Cancel this order?':modal.kind==='correct'?'Correct receipt status':'Confirm food received'}</h2>
   <p>{modal.kind==='cancel'?'Cancellation keeps the order and payment history. It does not issue a refund.':modal.kind==='correct'?'This corrects the delivery record. Stock and payments stay unchanged.':'Confirm only after the customer has received or collected the food. This action does not record a payment.'}</p>
   {['cancel','correct'].includes(modal.kind)&&<label>Reason<input data-initial-focus required maxLength="300" value={reason} onChange={e=>setReason(e.target.value)}/></label>}
   {modal.kind==='cancel'&&modal.order.ordering_mode==='simple'&&modal.order.inventory_deducted&&<label className="simple-order-select"><input type="checkbox" checked={returnStock} onChange={e=>setReturnStock(e.target.checked)}/>I confirm all allocated ingredients and packaging are unused and can be returned to stock.</label>}
   {error&&<p role="alert" className="simple-orders-error">{error}</p>}
   <footer><button type="button" disabled={busy} onClick={()=>setModal(null)}>Go back</button><button type="submit" disabled={busy}>{busy?'Saving…':modal.kind==='cancel'?'Confirm cancellation':modal.kind==='correct'?'Save correction':'Confirm received'}</button></footer>
  </form></div></ModalDialog>}
 </>;
}
