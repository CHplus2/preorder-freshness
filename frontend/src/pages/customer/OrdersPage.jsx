import OrderHandoverEditor from '../../components/OrderHandoverEditor';
import useOrderEmail from '../../hooks/useOrderEmail';
import OrderEmailReminder from '../../components/OrderEmailReminder';
import SellingDetails from '../../components/SellingDetails';
import {quantityLabel} from '../../utils/sellingDetails';
import OrderFulfilment from '../../components/OrderFulfilment';
import {isPickup,handoverLabel,methodLabel} from '../../utils/fulfilment';
import {Link} from 'react-router-dom';
import {ChevronRight,ReceiptText} from 'lucide-react';
import OrderProgress from '../../components/OrderProgress';
import {orderProgress} from '../../utils/orderProgress';
import ManualPayment from '../../components/ManualPayment';
import RescheduleOrder from '../../components/RescheduleOrder';
import { useEffect,useState } from "react";
import { useLocation } from "react-router-dom";
import { useUI } from "../../contexts/UIContext";
import { useOrder } from "../../contexts/OrderContext";
import {customerOrderGroups,customerDelivery} from "../../utils/customerExperience";
import "./OrdersPage.css";
import "./CustomerExperience.css";

export default function OrdersPage() {
  const location = useLocation();
  const orderEmail=useOrderEmail();
  const { formatOrderNumber, setAlert } = useUI();
  const { orders, fetchOrders, ordersLoading, ordersError } = useOrder();

  const [filter,setFilter]=useState(null),[limit,setLimit]=useState(10);
  const groups=customerOrderGroups(orders);
  const selected=filter || (groups.current.length?'current':'history');
  const visible=groups[selected];

  useEffect(() => {
    if (location.state?.formPayment) {
      setAlert({ message: location.state?.requestNeedsReview ? "Delivery request sent. Awaiting kitchen confirmation." : "Order placed successfully", type: "success" });

      // Clear state so it doesn't show again
      window.history.replaceState({}, document.title); 
    }
  }, [location.state?.formPayment, location.state?.requestNeedsReview, setAlert])

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <main className="orders-container customer-orders">
      <div className="customer-orders-heading customer-page-heading"><div><span className="dk-eyebrow">YOUR PREORDERS</span><h1 className="orders-title">My orders</h1><p>Collection, delivery progress and payments, in one place.</p></div><button type="button" disabled={ordersLoading} onClick={fetchOrders}>{ordersLoading?"Refreshing…":"Refresh order status"}</button></div>

      {ordersError && <p role="alert">{ordersError} <button disabled={ordersLoading} onClick={fetchOrders}>Retry loading orders</button></p>}
      {ordersLoading && <p role="status">Loading your orders…</p>}
      {!ordersLoading && !ordersError && orders.length>0 && <><div className="customer-order-filters" role="group" aria-label="Show orders">{[['current','Current'],['history','History'],['all','All orders']].map(([key,label])=><button key={key} type="button" aria-pressed={selected===key} onClick={()=>{setFilter(key);setLimit(10);}}>{label}<span>{groups[key].length}</span></button>)}</div><p className="customer-order-count" role="status">{visible.length?`Showing ${Math.min(limit,visible.length)} of ${visible.length} ${selected==='all'?'orders':selected==='current'?'current orders':'past orders'}.`:selected==='current'?'No current orders. Completed and cancelled orders are in History.':'No orders in this view.'}</p></>}
      {ordersLoading || ordersError ? null : visible.length > 0 ? (
        visible.slice(0,limit).map((order) => (
          <article key={order.id} className="order-card" aria-label={`Order ${formatOrderNumber(order.id)}`}>

            {/* HEADER */}
            <div className="order-header">
              <div>
                <h2 className="order-id">{order.status==='pending' && order.preparation_plan?.needs_review?`${handoverLabel(order)} request`:'Order'} #{formatOrderNumber(order.id)}</h2>
              </div>

              <span className={`status-badge status-${order.status}`}>
                {orderProgress(order.status,order.preparation_plan?.needs_review,isPickup(order)).label}
              </span>
            </div>

            <OrderProgress order={order}/>
            <dl className="customer-order-details"><div><dt>{order.status==='pending' && order.preparation_plan?.needs_review?`Requested ${handoverLabel(order).toLowerCase()}`:handoverLabel(order)}</dt><dd>{customerDelivery(order.delivery_at)} · {methodLabel(order.delivery_method)}</dd></div><div><dt>{isPickup(order)?'Collection fee':'Delivery fee'}</dt><dd>RM {order.shipping_fee}</dd></div><div><dt>Bulk discount</dt><dd>RM {order.discount_amount}</dd></div></dl>
            <OrderFulfilment order={order}/><ManualPayment order={order}/>{order.address && <details className="dk-panel customer-order-address"><summary>Delivery address</summary><p>{order.address.recipient_name}<br/>{order.address.line1}{order.address.line2 && <><br/>{order.address.line2}</>}<br/>{order.address.postal_code} {order.address.city}, {order.address.state}<br/>{order.address.phone}</p></details>}
            {/* BODY */}
            <div className="order-body">
              {order.items.map((item) => (
                <div key={item.id} className="order-item">
                  <div className="item-name">{item.product_name}<SellingDetails details={item.selling_details}/></div>
                  <span className="item-qty">{quantityLabel(item.selling_details,item.quantity)}</span>
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
            {order.payment_method==='escrow' && <section className="paypal-order-note" aria-label="Escrow payment"><div className="paypal-order-heading"><ReceiptText size={18} aria-hidden="true"/><strong>Escrow payment</strong><span>Sepolia</span></div><p>{order.payment_status==='paid'?'Verified funding recorded. Funds are held or credited under the escrow rules; withdrawal is separate.':order.payment_status==='refunded'?'Buyer refund credit verified. Withdraw funds through the escrow payment page.':'Funding has not been verified yet. Open this saved payment to fund or check it.'}</p><Link to={'/payment/escrow?order='+order.id}>View escrow payment<ChevronRight size={16} aria-hidden="true"/></Link></section>}
            {order.payment_method==='paypal' && <section className="paypal-order-note" aria-label="PayPal payment"><div className="paypal-order-heading"><ReceiptText size={18} aria-hidden="true"/><strong>PayPal</strong><span>Sandbox</span></div><p>{order.payment_status==='paid'?'Payment recorded. No real money was transferred.':order.payment_status==='refunded'?'Refund recorded. This was a Sandbox test payment.':'Test payment — no real money is transferred. Review this saved payment before trying again.'}</p><Link to={'/payment/paypal?order='+order.id}>{order.payment_status==='paid' || order.payment_status==='refunded'?'View payment details':'Continue to payment'}<ChevronRight size={16} aria-hidden="true"/></Link></section>}
            <OrderEmailReminder order={order} contact={orderEmail} onSaved={fetchOrders}/>
            <OrderHandoverEditor key={order.id+order.updated_at} order={order} onSaved={fetchOrders}/>
            <RescheduleOrder order={order} onSaved={fetchOrders}/>
            <Link className="customer-order-help" to={`/contact?order=${order.id}`}>Ask the kitchen about this order<ChevronRight size={16} aria-hidden="true"/></Link>

          </article>
        ))
      ) : (
        !ordersLoading && !orders.length && <div className="customer-empty"><h2>Your next meal starts here</h2><p>Choose something from the menu. Your orders and delivery updates will appear here.</p><Link className="dk-primary" to="/menu">Browse the menu</Link></div>
      )}
      {!ordersLoading && !ordersError && visible.length>limit && <button className="customer-show-more" type="button" onClick={()=>setLimit(n=>n+10)}>Show 10 more orders</button>}
    </main>
  );
}
