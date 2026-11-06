import {Link} from 'react-router-dom';
import {PackageSearch} from 'lucide-react';
import {stockQuantity} from '../utils/stockShortage';
import './AvailabilityResult.css';
import PreparationDays from './PreparationDays';

export default function AvailabilityResult({checking, error, quote, selectionKey, requestMode=true,shortage=null,onRetry,retryable=false}) {
  const packaging=shortage?.kind==='packaging',stockName=packaging?'packaging':'ingredients';
  let content = null;
  let tone = 'pending';
  if (checking) content = <><strong>Checking kitchen availability…</strong><p>This may take a few seconds.</p></>;
  else if(error && shortage){
    tone='stock';content=<><div className="stock-shortage-heading"><PackageSearch size={22} aria-hidden="true"/><div><strong>Some items need restocking</strong><p>The kitchen does not have enough recorded {stockName} for this basket{packaging?'.':' on your chosen date.'}</p></div></div>
      <ul className="stock-shortage-list">{shortage.rows.slice(0,5).map(row=><li key={row.packaging_item_id||row.raw_material_id}><span>{row.name}</span><span className="stock-shortage-amount">{stockQuantity(row.shortfall)} {row.unit} short</span><small>Needed {stockQuantity(row.required)} {row.unit} · Available {stockQuantity(row.available)} {row.unit}</small></li>)}</ul>
      {shortage.count>5&&<details><summary>View {shortage.count-5} more {stockName}</summary><ul className="stock-shortage-list">{shortage.rows.slice(5).map(row=><li key={row.packaging_item_id||row.raw_material_id}><span>{row.name}</span><span className="stock-shortage-amount">{stockQuantity(row.shortfall)} {row.unit} short</span><small>Needed {stockQuantity(row.required)} {row.unit} · Available {stockQuantity(row.available)} {row.unit}</small></li>)}</ul>{shortage.count>shortage.rows.length&&<p>The kitchen needs to review the remaining {stockName}.</p>}</details>}
      <p className="stock-shortage-help">Edit your basket or ask the kitchen about restocking. Moving the time alone will not add {stockName}.</p>
      <div className="stock-shortage-actions"><Link to="/cart">Edit basket</Link><Link to="/contact">Ask the kitchen</Link>{retryable&&onRetry&&<button type="button" onClick={onRetry}>Check stock again</button>}</div>
      <details className="stock-shortage-rules"><summary>Which stock counts?</summary><p>{packaging?'Only available packaging assigned to the menus counts. The kitchen records new supplies under Packaging.':'Stock must be received, not on hold, and within its recorded deadline on the chosen delivery date.'}</p></details></>;
  }
  else if (error) { tone = 'error'; content = <><strong>Availability could not be confirmed</strong><p>{error}</p></>; }
  else if (quote && quote.selectionKey !== selectionKey) content = <><strong>Please check availability again</strong><p>Your delivery time or basket has changed since the last check.</p></>;
  else if (quote?.plan.needs_review) {
    content = requestMode?<><strong>Kitchen confirmation needed</strong><p>You can send this time to the kitchen for review. No payment will be taken and no preparation time is reserved until confirmed.</p>{quote.plan.review_reason && <details><summary>Why kitchen confirmation is needed</summary><p>{quote.plan.review_reason}</p></details>}</>:<><strong>Choose another available time</strong><p>This time cannot be scheduled with the current kitchen bookings. Choose one of the suggested alternatives above, or ask the kitchen to review this time.</p></>;
  }
  else if (quote?.plan.ordering_mode==='simple') {
    tone='success';content=<><strong>Food is available for this basket</strong><p>Recorded ingredient and packaging stock covers this basket for the selected date. Stock is checked again and deducted when you place the order.</p></>;
  }
  else if (quote) {
    tone = 'success';
    content = <><strong>Your requested time is available</strong><p>You can continue to place your preorder. Availability will be checked again when you order.</p>{quote.plan.procurement_required && <p><strong>Ingredients need purchasing.</strong> Kitchen time fits; the owner must source suitable stock before cooking.</p>}<details><summary>View preparation details</summary><PreparationDays plan={quote.plan}/><p>Preparation starts {new Date(quote.plan.preparation_at).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'})}. {quote.plan.hands_on_minutes} minutes of hands-on work.</p><p>{quote.plan.procurement_required ? 'The owner needs to purchase ingredients for this plan.' : 'Recorded ingredients cover this estimate; stock is not reserved until cooking.'}</p></details></>;
  }
  return <div id="availability-result" aria-live="polite" aria-atomic="true" aria-busy={checking}>{content && <div className={`availability-result availability-result--${tone}`} role={error ? 'alert' : 'status'}>{content}</div>}</div>;
}
