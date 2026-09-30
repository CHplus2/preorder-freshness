import {createPortal} from 'react-dom';
import {packingList} from '../utils/packing';
import './PackingList.css';

const time = value => new Date(value).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'});
function Sheet({list,date}) {
  return <div className="packing-sheet"><h2>Packing list · {date}</h2>
    <p>{list.orders.length} orders · {list.portions} portions · Malaysia delivery date</p>
    <p>Pending, processing and cooked orders only. Dispatched orders are excluded. Refresh before packing; printed copies may become outdated.</p>
    {list.unscheduled>0 && <p role="alert">{list.unscheduled} active orders have no valid delivery time and are excluded. Review them in All Orders.</p>}
    {!list.orders.length ? <p>No orders awaiting dispatch for this date.</p> : <>
      <h3>Menu quantities to check</h3><ul className="packing-totals">{list.menus.map(m=><li key={m.key}><span>{m.name}</span><strong>{m.quantity} portions</strong></li>)}</ul>
      <p>These are packing totals. Follow each order’s accepted recipe and preparation plan when cooking.</p>
      <h3>Check each order before dispatch</h3>
      {list.orders.map(o=><article className="packing-order" key={o.id}><h4>ORD-{String(o.id).padStart(5,'0')} · {time(o.delivery_at)}</h4>
        <p>{o.status} · {o.delivery_method==='express'?'Express requested':'Owner delivery'} · Payment: {o.payment_status}</p>
        <ul>{o.items.map(i=><li key={i.id}><span className="packing-box" aria-hidden="true">□</span> {i.quantity} × {i.product_name}</li>)}</ul>
        <p className="packing-signoff">□ Quantities checked &nbsp; □ Labels checked &nbsp; Checked by: __________</p>
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
