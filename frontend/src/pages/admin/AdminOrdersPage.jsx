import { useEffect, useState } from "react";
import { useUI } from "../../contexts/UIProvider";
import { useOrder } from "../../contexts/OrderProvider";


export default function AdminOrdersPage() {
  const [editingOrder, setEditingOrder] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [newPaymentStatus, setNewPaymentStatus] = useState("");
  const { formatOrderNumber } = useUI();
  const { adminOrders, fetchAdminOrders, updateOrder } = useOrder();

  useEffect(() => {
    fetchAdminOrders();
  }, [fetchAdminOrders]);

  const startEdit = (order) => {
    setEditingOrder(order);
    setNewStatus(order.status || "pending");
    setNewPaymentStatus(order.payment_status || "unpaid");
  };

  const saveEdit = async () => {
    if (!editingOrder) return;

    const saved = await updateOrder(editingOrder.id, newStatus, newPaymentStatus);
    if (!saved) return;

    setEditingOrder(null);
    fetchAdminOrders();
  };

  return (
    <div className="orders-container">
      <h1 className="orders-title">All Orders</h1>

      {adminOrders.length > 0 ? (
        <>
          {adminOrders.map((order) => (
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
              <div className="order-footer">
                <button className="edit-btn" onClick={() => startEdit(order)}>
                  Edit order
                </button>

                <div className="order-total">
                  RM {(Number(order.total_amount)+Number(order.shipping_fee)).toFixed(2)}
                </div>
              </div>

            </div>
          ))}

          {editingOrder && (
            <>
              <div className="modal-overlay" onClick={() => setEditingOrder(null)}></div>

              <div className="edit-modal">
                <h2>Order #{editingOrder.id}</h2>

                {/* Address Section */}
                <div className="modal-address-block">
                  <strong>Shipping Address:</strong>
                  <p>
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
                  </p>
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
                <label htmlFor="payment-select">Payment Status:</label>
                <select
                  id="payment-select"
                  value={newPaymentStatus}
                  onChange={(e) => setNewPaymentStatus(e.target.value)}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>

                <div className="modal-actions">
                  <button className="modal-save" onClick={saveEdit}>Save</button>
                  <button className="modal-cancel" onClick={() => setEditingOrder(null)}>Close</button>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="orders-empty">You have no orders yet.</p>
      )}
    </div>
  );
}
