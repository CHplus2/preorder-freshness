import {useCallback} from 'react';
import {Link, useParams} from 'react-router-dom';
import useClientReport from '../../hooks/useClientReport';
import {printableSlip, reportMoney} from '../../utils/clientReports';
import {arrivalLabel} from '../../utils/arrivalWindow';
import {orderDate} from '../../utils/orderPresentation';
import './OrderPrintPage.css';

export function OrderSlip({order}) {
 const pickup = order.delivery_method === 'pickup';
 return <article className="order-slip-paper" aria-label="Printable order slip">
  <header><p>{order.kitchen}</p><h1>Order #ORD-{String(order.id).padStart(5,'0')}</h1><p>{order.receipt_status==='cancelled'?'Cancelled':order.receipt_status==='received'?'Received':'Not received'} · Payment: {order.payment_status}</p></header>
  <section><h2>{pickup?'Self-collection':'Delivery'}</h2><p>{arrivalLabel(order)}</p><dl><div><dt>Customer name / Nama</dt><dd>{order.name}</dd></div><div><dt>Phone / Telefon</dt><dd>{order.phone||'Not recorded'}</dd></div><div><dt>{pickup?'Collection location':'Address / Alamat'}</dt><dd>{pickup?(order.pickup_location||'Not recorded'):order.address_lines.length?order.address_lines.map((line,index)=><span key={index}>{line}</span>):'Not recorded'}</dd></div></dl>{order.handover_location&&<p><strong>Agreed handover place:</strong> {order.handover_location}</p>}{order.handover_notes&&<p><strong>Instructions:</strong> {order.handover_notes}</p>}</section>
  <table><caption>Order items · accepted prices</caption><thead><tr><th scope="col">Menu</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Food total</th></tr></thead><tbody>{order.items.map(item=><tr key={item.id}><th scope="row">{item.name}</th><td>{item.quantity}</td><td>{reportMoney(item.unit_price)}</td><td>{reportMoney(item.food_total)}</td></tr>)}</tbody></table>
  <dl className="order-slip-totals"><div><dt>Food after discounts</dt><dd>{reportMoney(order.food_total)}</dd></div><div><dt>Discount included</dt><dd>{reportMoney(order.discount)}</dd></div><div><dt>{pickup?'Collection fee':'Delivery fee'}</dt><dd>{reportMoney(order.delivery_fee)}</dd></div><div><dt>Order total</dt><dd>{reportMoney(order.total)}</dd></div><div><dt>Payment method</dt><dd>{({cod:'Cash',cash:'Cash',manual:pickup?'DuitNow QR':'QR / bank transfer',duitnow:'DuitNow QR',paypal:'PayPal',wallet:'Wallet',escrow:'Escrow'})[order.payment_method]||order.payment_method||'Not recorded'}</dd></div></dl>
  <footer><p>Order slip, not proof of payment. Check Payment records for receipts, refunds or outstanding balances.</p><p>Prepared for printing: {orderDate(order.printed_at)} · Malaysia time</p></footer>
 </article>;
}

export default function OrderPrintPage() {
 const {id} = useParams();
 const validate = useCallback(data=>printableSlip(data,Number(id)),[id]);
 const report = useClientReport(`/api/admin/orders/${encodeURIComponent(id)}/slip/`,validate);
 return <main className="order-slip-page">
  <div className="order-slip-tools"><Link to={`/admin/orders?order=${id}`}>Back to order</Link><button type="button" disabled={!report.data||report.loading} onClick={()=>window.print()}>Print / Save PDF</button><button type="button" disabled={report.loading} onClick={report.refresh}>Refresh slip</button><p>{report.loadedAt?`Loaded ${report.loadedAt.toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})} · Malaysia time. `:''}Refresh after changing an order. Keep printed customer details private.</p></div>
  {report.loading&&<p role="status">Loading order slip…</p>}{report.error&&<p role="alert">{report.error}</p>}
  {report.data&&<OrderSlip order={report.data}/>}
 </main>;
}
