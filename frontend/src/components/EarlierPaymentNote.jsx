import {earlierPayment} from '../utils/operationalOrders';
export default function EarlierPaymentNote({order}){
 const record=earlierPayment(order);if(!record)return null;
 return <section className="dk-panel earlier-payment-note" aria-label="Earlier payment record"><h3>Earlier payment record</h3><p><strong>{record.label}</strong> · Recorded status: {order.payment_status}</p><p>{record.note}</p><p>This order keeps its original payment history. Current checkout offers bank QR / bank transfer, or cash for delivery. Contact the kitchen about this saved record.</p></section>;
}
