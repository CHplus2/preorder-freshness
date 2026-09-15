import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useUI } from "../../contexts/UIProvider";
import { useOrder } from "../../contexts/OrderProvider";
import "./OrdersPage.css";

export default function OrdersPage() {
  const location = useLocation();
  const { formatOrderNumber, setAlert } = useUI();
  const { orders,  fetchOrders } = useOrder();

  useEffect(() => {
    if (location.state?.formPayment) {
      setAlert({ message: "Order placed successfully", type: "success" });

      // Clear state so it doesn't show again
      window.history.replaceState({}, document.title); 
    }
  }, [location.state?.formPayment, setAlert])

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="orders-container">
      <h1 className="orders-title">My Orders</h1>

      {orders.length > 0 ? (
        orders.map((order) => (
          <div key={order.id} className="order-card">

            {/* HEADER */}
            <div className="order-header">
              <div>
                <p className="order-id">Order #{formatOrderNumber(order.id)}</p>
              </div>

              <span className={`status-badge status-${order.status}`}>
                {order.status}
              </span>
            </div>

            <p>Delivery: {order.delivery_at ? new Date(order.delivery_at).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'}) : 'Contact owner to arrange'} · {order.delivery_method}</p>
            <p>Bulk discount: RM {order.discount_amount} · Delivery fee: RM {order.shipping_fee}</p>
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
              <div className="payment-status">
                Payment: <strong>{order.payment_status}</strong>
              </div>

              <div className="order-total">
                RM {(Number(order.total_amount)+Number(order.shipping_fee)).toFixed(2)}
              </div>
            </div>

          </div>
        ))
      ) : (
        <p className="orders-empty">You have no orders yet.</p>
      )}
    </div>
  );
}
