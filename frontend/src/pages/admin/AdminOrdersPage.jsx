import {Link,useSearchParams} from 'react-router-dom';
import './OrderCardSpacing.css';
import DialogFeedback from '../../components/DialogFeedback';
import PaymentRecords from '../../components/PaymentRecords';
import AcceptedRecipe from '../../components/AcceptedRecipe';
import RescheduleOrder from '../../components/RescheduleOrder';
import ModalDialog from '../../components/ModalDialog';
import { useEffect, useRef, useState } from "react";
import { useUI } from "../../contexts/UIContext";
import { useOrder } from "../../contexts/OrderContext";
import {filterOrders,overdueOrder,archivedOnlyOrder,hiddenArchivedHistory,orderMenuState} from '../../utils/orderQueue';
import useOrderCatalogue from '../../hooks/useOrderCatalogue';
import GeneratedHistoryCard from '../../components/GeneratedHistoryCard';
import {closedGeneratedHistory,generatedSalesHistory,orderStatusLabel,orderDate} from '../../utils/orderPresentation';


export default function AdminOrdersPage() {
  const emptyFilters={search:'',status:'',payment:'',date:'',overdue:false,sort:'newest',includeArchived:false,historyScope:'orders'};
  const [params,setParams]=useSearchParams();
  const review=['missing-delivery','archived-menus'].includes(params.get('review'))?params.get('review'):'';
  const changeReview=value=>{setFilters(emptyFilters);setParams(value?{review:value}:{});};
  const [filters,setFilters]=useState({...emptyFilters,search:/^[1-9]\d*$/.test(params.get('order') || '')?'#ORD-'+params.get('order').padStart(5,'0'):''});
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const { formatOrderNumber } = useUI();
  const { adminOrders, fetchAdminOrders, updateOrder, adminOrdersLoading, adminOrdersError } = useOrder();
  const {catalogue,error:catalogueError,retry:retryCatalogue}=useOrderCatalogue(adminOrders);
  const visibleOrders=filterOrders(adminOrders,{...filters,review},now,catalogue);
  const archivedHistoryCount=adminOrders.filter(order=>hiddenArchivedHistory(order,catalogue)).length;
  const generatedCount=adminOrders.filter(closedGeneratedHistory).length;
  const historyView=filters.historyScope==='generated';
  const resultKind=historyView?'history record':filters.historyScope==='all'?'record':'order';
  const clearFilters=()=>{setFilters({...emptyFilters,historyScope:filters.historyScope,includeArchived:historyView});setParams({});};

  useEffect(() => {
    fetchAdminOrders();
  }, [fetchAdminOrders]);

  const startEdit = (order,preferredStatus) => {
    setEditingOrder(order);
    setNewStatus(preferredStatus || order.status || "pending");
  };

  const saveEdit = async () => {
    if (!editingOrder || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      const saved = await updateOrder(editingOrder.id, newStatus);
      if (!saved) return;
      setEditingOrder(null);
      await fetchAdminOrders();
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="orders-container">
      <h1 className="orders-title">{review==='missing-delivery'?'Review missing delivery dates':review==='archived-menus'?'Orders containing only archived menus':filters.historyScope==='generated'?'Generated sales history':'Orders'}</h1>
      {review==='missing-delivery' && <p className="order-review-explanation">Set an agreed future date to keep a request open, or review closing an obsolete request. Setting a date does not mark an order paid or delivered.</p>}
      {review==='archived-menus' && <p className="order-review-explanation">Every item in these orders refers to an archived menu. Open orders still need a decision; archiving a menu does not cancel a booking.</p>}
      {generatedCount>0 && <div className="admin-tabs order-record-tabs" role="group" aria-label="Order record source">{[['orders',`Orders (${adminOrders.length-generatedCount})`],['generated',`Generated history (${generatedCount})`],['all','All records']].map(([value,label])=><button key={value} aria-pressed={filters.historyScope===value} onClick={()=>{setFilters({...emptyFilters,historyScope:value,includeArchived:value==='generated'});setParams({});}}>{label}</button>)}</div>}
      {filters.historyScope==='generated' && <p className="order-source-note">Generated daily sales summaries used by FreshCast. These are fictional history, separate from customer orders.</p>}
      <div className="fyp-form inline" aria-label="Filter orders">
        {!historyView && <label>Review records<select value={review} onChange={e=>changeReview(e.target.value)}><option value="">Order queue</option><option value="missing-delivery">Open orders missing delivery dates</option><option value="archived-menus" disabled={!catalogue}>Archived menus only</option></select></label>}
        <label>{historyView?'Search history or menu':'Search order, customer or menu'}<input type="search" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/></label>
        {!historyView && <><label>Order status<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option>{['pending','processing','cooked','shipped','delivered','cancelled'].map(s=><option key={s} value={s}>{orderStatusLabel(s)}</option>)}</select></label>
        <label>Payment<select value={filters.payment} onChange={e=>setFilters({...filters,payment:e.target.value})}><option value="">All payments</option>{['unpaid','paid','refunded'].map(s=><option key={s} value={s}>{s}</option>)}</select></label></>}
        <label>{historyView?'Sales date (Malaysia)':'Delivery date (Malaysia)'}<input type="date" value={filters.date} onChange={e=>setFilters({...filters,date:e.target.value})}/></label>
        <label>Sort by<select value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value})}><option value="newest">{historyView?'Newest record':'Newest order'}</option><option value="delivery">{historyView?'Earliest sales date':'Earliest delivery'}</option></select></label>
      </div>
      <div className="admin-toolbar">{!historyView && <label className="owner-overdue-filter"><input type="checkbox" checked={filters.overdue} onChange={e=>setFilters({...filters,overdue:e.target.checked})}/> Overdue deliveries only</label>}<button onClick={clearFilters}>Clear filters</button><button disabled={adminOrdersLoading} onClick={fetchAdminOrders}>Refresh {historyView?'history':'orders'}</button></div>
      {!historyView && (archivedHistoryCount>0 || !catalogue) && <div className="order-history-scope"><label className="owner-overdue-filter"><input type="checkbox" checked={filters.includeArchived || review==='archived-menus'} disabled={review==='archived-menus' || !catalogue} onChange={e=>setFilters({...filters,includeArchived:e.target.checked})}/> Include completed or cancelled archived-menu history</label>
        <p>{catalogue ? `${archivedHistoryCount} archived-menu history records available. Open requests stay visible.` : catalogueError ? 'Menu status is unavailable; archived history has not been filtered.' : 'Checking menu status…'}</p>
        {catalogueError && <p role="alert">Menu status could not be loaded: {catalogueError} <button type="button" onClick={retryCatalogue}>Retry menu status</button></p>}
      </div>}
      {!adminOrdersLoading && !adminOrdersError && <p className="order-results-summary" role="status">{visibleOrders.length} {resultKind}{visibleOrders.length===1?'':'s'} shown{filters.historyScope==='orders' && generatedCount>0?` · ${generatedCount} generated history records in a separate view`:''}{!historyView && adminOrders.some(o=>overdueOrder(o,now))?` · ${adminOrders.filter(o=>overdueOrder(o,now)).length} overdue deliveries`:''}</p>}

      {adminOrdersError && <p role="alert">{adminOrdersError} <button disabled={adminOrdersLoading} onClick={fetchAdminOrders}>Retry loading orders</button></p>}
      {adminOrdersLoading && <p role="status">Loading orders…</p>}
      {adminOrdersError ? null : adminOrders.length > 0 ? (
        <>
          {!visibleOrders.length && <p>No records match these filters. Adjust the filters or choose another record view.</p>}
          {visibleOrders.map(order => closedGeneratedHistory(order) ? <GeneratedHistoryCard key={order.id} order={order} reference={formatOrderNumber(order.id)}/> : (
            <div key={order.id} className="order-card">

              {/* HEADER */}
              <div className="order-header">
                <div>
                  <p className="order-id">Order #{formatOrderNumber(order.id)}</p>
                  {archivedOnlyOrder(order,catalogue) && <span className="order-archived-label">Archived menus only</span>}
                  <p className="order-user">
                    {generatedSalesHistory(order)?'Generated history record':order.user?.username ?? "Unknown"}
                  </p>
                </div>

                <div className="badge-group">
                  <span className={`status-badge status-${order.status}`}>
                    {orderStatusLabel(order.status)}
                  </span>

                  <span className={`payment-badge payment-${order.payment_status}`}>
                    {order.payment_status}
                  </span>
                </div>
              </div>

              <dl className="order-key-dates"><div><dt>Delivery</dt><dd>{orderDate(order.delivery_at)}</dd></div><div><dt>Preparation starts</dt><dd>{order.preparation_at?orderDate(order.preparation_at):'Needs a plan'}</dd></div></dl>
              {generatedSalesHistory(order) && <p className="owner-order-note">Demo data · Generated history record requiring review; not a customer transaction.</p>}
              {review==='missing-delivery' && catalogue && <p className="owner-order-note">{orderMenuState(order,catalogue)==='unlinked'?'Some menu references are missing from the catalogue. An old name in an order is a historical snapshot; it does not prove the menu is still available.':orderMenuState(order,catalogue)==='archived'?'This request contains only archived menus. Review whether it is still needed.':orderMenuState(order,catalogue)==='mixed'?'This request mixes current and archived menus. Review the items before arranging a new date.':'Menu references are available. Use Set delivery date to review a future request.'}</p>}
              {overdueOrder(order,now) && <p className="admin-follow-up"><strong>Delivery follow-up</strong><span>The requested time has passed. Confirm delivery with the customer, then update the order status.</span></p>}
              {order.status==='pending' && order.preparation_plan?.needs_review && <div className="owner-order-note"><strong>Delivery time awaiting your confirmation</strong><p>Review the recipe, kitchen workload and handling limits. Contact the customer if another time is needed. Set and confirm preparation times in Planner before moving this order to Processing.</p><details><summary>Automatic planning notes</summary><p>{order.preparation_plan.review_reason}</p></details></div>}
              {/* BODY */}
              <div className="order-body">
                {order.items.map((item) => (
                  <div key={item.id} className="order-item">
                    <span className="item-name">{item.product_name}</span>
                    <span className="item-qty">x{item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* FOOTER */}
              <div className="order-footer owner-order-footer"><div className="owner-order-actions">
                <button className="edit-btn" onClick={() => startEdit(order)}>
                  Edit order
                </button>
                {review==='missing-delivery' && order.status==='pending' && !order.inventory_deducted && <button onClick={()=>startEdit(order,'cancelled')}>Review closing request</button>}
                <button onClick={()=>setPaymentOrder(paymentOrder?.id===order.id?null:order)}>Payment records</button>

                </div><div className="order-total">
                  RM {(Number(order.total_amount)+Number(order.shipping_fee)).toFixed(2)}
                </div>
              </div>
              {order.items.some(i=>i.recipe_source?.startsWith('legacy')) && <p className="owner-order-note">Review this older order’s recipe in Planner before preparation.</p>}
              {paymentOrder?.id===order.id && <PaymentRecords order={order} onSaved={fetchAdminOrders}/>}
              <AcceptedRecipe order={order}/>
              <RescheduleOrder order={order} onSaved={fetchAdminOrders}/>

            </div>
          ))}

          {editingOrder && (
            <ModalDialog label={"Edit order " + editingOrder.id} onDismiss={() => setEditingOrder(null)}>
              <div className="modal-overlay" onClick={() => setEditingOrder(null)}></div>

              <div className="edit-modal">
                <h2>{newStatus==='cancelled' && editingOrder.status!=='cancelled'?'Review closing order':'Order'} #{editingOrder.id}</h2>
                {newStatus==='cancelled' && editingOrder.status!=='cancelled' && <p>This closes the open request and removes it from upcoming preparation. It keeps its order reference and history. Payments and refunds are handled separately.</p>}
          <DialogFeedback/>

                {/* Address Section */}
                <div className="modal-address-block">
                  <strong>Shipping Address:</strong>
                  {editingOrder.address ? <p>
                    {editingOrder.address?.recipient_name}<br />
                    {editingOrder.address?.line1}<br />
                    {editingOrder.address?.line2 && (
                      <>
                        {editingOrder.address.line2}<br />
                      </>
                    )}
                    {editingOrder.address?.city}, {editingOrder.address?.state}{" "}
                    {editingOrder.address?.postal_code}<br />
                    {editingOrder.address?.country}<br />
                    Phone: {editingOrder.address?.phone}
                  </p> : <p>No delivery address recorded for this order. Confirm the address with the customer before dispatch.</p>}
                </div>

                {editingOrder.preparation_plan?.needs_review && <p className="owner-order-note"><Link to="/admin/planner">Open Planner</Link>. Set and confirm preparation times in Planner first. You can then move the order to Processing when work starts.</p>}
                <section aria-label="Delivery time">
                  <h3>Delivery time</h3>
                  <p>{editingOrder.delivery_at ? new Date(editingOrder.delivery_at).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'}) : 'No delivery time recorded'} · Malaysia time</p>
                  <RescheduleOrder key={editingOrder.id} order={editingOrder} onSaved={async () => {
                    setEditingOrder(null);
                    await fetchAdminOrders();
                  }}/>
                </section>
                {/* Status Select */}
                <label htmlFor="status-select">Order Status:</label>
                <select
                  id="status-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="cooked">Cooked — deduct ingredients</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                {/* Payment Status Select */}
                <p>Payment: {editingOrder.payment_status}. Close this dialog and open Payment records to record verified receipts or refunds. Cancelling an order does not refund it automatically.</p>

                <div className="modal-actions">
                  <button className="modal-save" disabled={saving} onClick={saveEdit}>{saving ? 'Saving...' : newStatus==='cancelled' && editingOrder.status!=='cancelled'?'Confirm close request':'Save'}</button>
                  <button className="modal-cancel" onClick={() => setEditingOrder(null)}>Close</button>
                </div>
              </div>
            </ModalDialog>
          )}
        </>
      ) : (
        !adminOrdersLoading && <p className="orders-empty">You have no orders yet.</p>
      )}
    </div>
  );
}
