import {orderCustomerName} from '../utils/operationalOrders';
import {arrivalLabel} from '../utils/arrivalWindow';

export default function OrderReceiptReview({orders,formatOrderNumber}){
 return <div className="order-receipt-review"><p><strong>{orders.length===1?'Order to update':`${orders.length} orders to update`}</strong></p><ul>{orders.map(order=><li key={order.id}><div><strong>#{formatOrderNumber(order.id)}</strong><span>{orderCustomerName(order)}</span></div><small>{order.delivery_method==='pickup'?'Self-collection':'Delivery'} · {arrivalLabel(order)}</small></li>)}</ul></div>;
}
