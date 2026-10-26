import {arrivalLabel} from '../utils/arrivalWindow';
import HandoverDetails from './HandoverDetails';
import SellingDetails from './SellingDetails';
import {quantityLabel} from '../utils/sellingDetails';
import {createPortal} from 'react-dom';
import {packingList} from '../utils/packing';
import {methodLabel} from '../utils/fulfilment';
import './PackingList.css';

function Sheet({list,date}) {
  return <div className="packing-sheet"><h2>Packing list · {date}</h2>
    <p>{list.orders.length} orders · {list.portions} selling units · Malaysia collection / delivery date</p>
    <p>Scheduled pending, processing and cooked orders only. Unconfirmed requests and dispatched orders are excluded. Refresh before packing; printed copies may become outdated.</p>
    {list.awaitingConfirmation>0 && <p role="status">{list.awaitingConfirmation} delivery {list.awaitingConfirmation===1?'request needs':'requests need'} confirmation for this date and {list.awaitingConfirmation===1?'is':'are'} excluded from packing totals.</p>}
    {list.needsPreparationReview>0 && <p role="alert">{list.needsPreparationReview} dated orders have missing or stale preparation plans and are excluded. Review their plans before packing.</p>}
    {list.unscheduled>0 && <p role="alert">{list.unscheduled} active orders have no valid delivery time and are excluded. Review them in All Orders.</p>}
    {!list.orders.length ? <p>No orders awaiting dispatch for this date.</p> : <>
      <h3>Menu quantities to check</h3><ul className="packing-totals">{list.menus.map(m=><li key={m.key}><div>{m.name}<SellingDetails details={m.selling_details}/></div><strong>{quantityLabel(m.selling_details,m.quantity)}</strong></li>)}</ul>
      <p>These are packing totals. Follow each order’s accepted recipe and preparation plan when cooking.</p>
      <h3>Check each order before dispatch</h3>
      {list.orders.map(o=><article className="packing-order" key={o.id}><h4>ORD-{String(o.id).padStart(5,'0')} · {arrivalLabel(o)}</h4>
        <p>{o.status} · {methodLabel(o.delivery_method)} · Payment: {o.payment_status}</p>
        {o.delivery_method==='pickup' && <p>Collect from: {o.fulfilment_snapshot?.pickup_location || 'Confirm location with the kitchen'}</p>}
        <ul>{o.items.map(i=><li key={i.id}><span className="packing-box" aria-hidden="true">□</span> {quantityLabel(i.selling_details,i.quantity)} × {i.product_name}<SellingDetails details={i.selling_details}/></li>)}</ul>
        <HandoverDetails order={o}/><p className="packing-signoff">□ Quantities checked &nbsp; □ Labels checked &nbsp; Checked by: __________</p>
      </article>)}
    </>}
  </div>;
}

export default function PackingList({orders,date,loading,error}) {
  const list = packingList(orders,date);
  return <section aria-label="Daily packing list">
    <div className="packing-actions"><button disabled={loading || !!error || !list.orders.length} onClick={()=>window.print()}>Print packing list</button><span>Paper checklist only; ticking it does not update order status.</span></div>
    {loading && <p role="status">Refreshing orders… Wait before printing.</p>}
    {error && <p role="alert">Orders could not be refreshed. Retry before printing this list.</p>}
    <Sheet list={list} date={date}/>
    {createPortal(<div className="packing-print-sheet"><Sheet list={list} date={date}/><p>Snapshot generated {new Date().toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})} · Malaysia time</p></div>,document.body)}
  </section>;
}
