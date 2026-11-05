import {useStorefront} from '../contexts/StorefrontContext';
export default function ManualPayment({order}){
 const current=useStorefront()?.store?.ordering_mode==='simple';
 if(order.payment_method!=='manual')return null;
 if(current&&order.ordering_mode==='scheduled'&&!order.payment_proof)return <section className="dk-panel manual-payment"><h3>Earlier bank-transfer arrangement</h3><p>Recorded payment status: <strong>{order.payment_status}</strong>. This order keeps its accepted payment history. Contact the kitchen before making any further payment.</p></section>;
 if(order.payment_proof)return <section className="dk-panel manual-payment"><h3>Bank QR / bank transfer</h3><p>{order.payment_status==='refunded'?'The kitchen has recorded this payment as refunded.':order.status==='cancelled'?'Order cancelled. Contact the kitchen about any payment already made.':order.payment_status==='paid'?'The kitchen has verified this payment.':'Receipt submitted. The kitchen will verify it against bank records. Do not pay again.'}</p><a href={order.payment_proof.url} target="_blank" rel="noopener noreferrer">View payment receipt</a></section>;
 return <section className="dk-panel manual-payment"><h3>Bank QR / bank transfer</h3><p>Payment status: <strong>{order.payment_status}</strong>. The owner confirms payment against their bank records.</p>
 {order.payment_status==='unpaid' && order.status!=='cancelled' && <><p>Transfer RM {(Number(order.total_amount)+Number(order.shipping_fee)).toFixed(2)}. Use <strong>Order #{order.id}</strong> as your transfer reference. Do not pay again if you have already transferred.</p><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{order.payment_instructions?.instructions}</p>{order.payment_instructions?.qr_url && <a href={order.payment_instructions.qr_url} target="_blank" rel="noreferrer">Open the kitchen's receiving bank QR image</a>}<p>Confirm the recipient name and amount in your banking app before paying.</p></>}
 </section>
}
