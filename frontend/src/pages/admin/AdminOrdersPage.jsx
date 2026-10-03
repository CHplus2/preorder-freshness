import './OrderCardSpacing.css';
import DialogFeedback from '../../components/DialogFeedback';
import PaymentRecords from '../../components/PaymentRecords';
import AcceptedRecipe from '../../components/AcceptedRecipe';
import RescheduleOrder from '../../components/RescheduleOrder';
import ModalDialog from '../../components/ModalDialog';
import { useEffect, useRef, useState } from "react";
import { useUI } from "../../contexts/UIProvider";
import { useOrder } from "../../contexts/OrderProvider";
import {filterOrders,overdueOrder} from '../../utils/orderQueue';


export default function AdminOrdersPage() {
  const emptyFilters={search:'',status:'',payment:'',date:'',overdue:false,sort:'newest'};
  const [filters,setFilters]=useState(emptyFilters);
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const { formatOrderNumber } = useUI();
  const { adminOrders, fetchAdminOrders, updateOrder, adminOrdersLoading, adminOrdersError } = useOrder();
  const visibleOrders=filterOrders(adminOrders,filters,now);

  useEffect(() => {
    fetchAdminOrders();
  }, [fetchAdminOrders]);

  const startEdit = (order) => {
    setEditingOrder(order);
    setNewStatus(order.status || "pending");
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
      <h1 className="orders-title">All Orders</h1>
      <div className="fyp-form inline" aria-label="Filter orders">
        <label>Search order, customer or menu<input type="search" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/></label>
        <label>Order status<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option>{['pending','processing','cooked','shipped','delivered','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        <label>Payment<select value={filters.payment} onChange={e=>setFilters({...filters,payment:e.target.value})}><option value="">All payments</option>{['unpaid','paid','refunded'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        <label>Delivery date (Malaysia)<input type="date" value={filters.date} onChange={e=>setFilters({...filters,date:e.target.value})}/></label>
        <label>Sort by<select value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value})}><option value="newest">Newest order</option><option value="delivery">Earliest delivery</option></select></label>
      </div>
      <div className="admin-toolbar"><label className="owner-overdue-filter"><input type="checkbox" checked={filters.overdue} onChange={e=>setFilters({...filters,overdue:e.target.checked})}/> Overdue deliveries only</label><button onClick={()=>setFilters(emptyFilters)}>Clear filters</button><button disabled={adminOrdersLoading} onClick={fetchAdminOrders}>Refresh orders</button></div>
      {!adminOrdersLoading && !adminOrdersError && <p role="status">Showing {visibleOrders.length} of {adminOrders.length} orders. {adminOrders.filter(o=>overdueOrder(o,now)).length} open orders are past their requested delivery time.</p>}

      {adminOrdersError && <p role="alert">{adminOrdersError} <button disabled={adminOrdersLoading} onClick={fetchAdminOrders}>Retry loading orders</button></p>}
      {adminOrdersLoading && <p role="status">Loading orders…</p>}
      {adminOrdersError ? null : adminOrders.length > 0 ? (
        <>
          {!visibleOrders.length && <p>No orders match these filters. Clear filters to see all orders.</p>}
          {visibleOrders.map((order) => (
            <div key={order.id} className="order-card">

              {/* HEADER */}
              <div className="order-header">
                <div>
                  <p className="order-id">Order #{formatOrderNumber(order.id)}</p>
                  <p className="order-user">
                    {order.user?.username ?? "Unknown"}
                  </p>
                </div>

                <div className="badge-group">
                  <span className={`status-badge status-${order.status}`}>
                    {order.status}
                  </span>

                  <span className={`payment-badge payment-${order.payment_status}`}>
                    {order.payment_status}
                  </span>
                </div>
              </div>

              <p>Prepare: {order.preparation_at ? new Date(order.preparation_at).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'}) : 'Legacy order — unscheduled'}</p>
              <p>Deliver: {order.delivery_at ? new Date(order.delivery_at).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'}) : 'Unscheduled'} · {order.delivery_method}</p>
              {overdueOrder(order,now) && <p className="admin-notice error">Past requested delivery time — confirm fulfilment and update this order.</p>}
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
                <button onClick={()=>setPaymentOrder(paymentOrder?.id===order.id?null:order)}>Payment records</button>

                </div><div className="order-total">
                  RM {(Number(order.total_amount)+Number(order.shipping_fee)).toFixed(2)}
                </div>
              </div>
              {order.items.some(i=>i.recipe_source?.startsWith('legacy')) && <p className="owner-order-note">Earlier order: recipe history is a legacy baseline or unknown. Review pending orders in Planner before preparation.</p>}
              {paymentOrder?.id===order.id && <PaymentRecords order={order} onSaved={fetchAdminOrders}/>}
              <AcceptedRecipe order={order}/>
              <RescheduleOrder order={order} onSaved={fetchAdminOrders}/>

            </div>
          ))}

          {editingOrder && (
            <ModalDialog label={"Edit order " + editingOrder.id} onDismiss={() => setEditingOrder(null)}>
              <div className="modal-overlay" onClick={() => setEditingOrder(null)}></div>

              <div className="edit-modal">
                <h2>Order #{editingOrder.id}</h2>
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
                  <button className="modal-save" disabled={saving} onClick={saveEdit}>{saving ? 'Saving...' : 'Save'}</button>
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
