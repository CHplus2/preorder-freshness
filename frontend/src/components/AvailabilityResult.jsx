import {Link} from 'react-router-dom';
import {CalendarDays} from 'lucide-react';
import './AvailabilityResult.css';
import PreparationDays from './PreparationDays';

export default function AvailabilityResult({checking, error, quote, selectionKey, requestMode=true,shortage=null,onRetry,retryable=false}) {
  let content = null;
  let tone = 'pending';
  if (checking) content = <><strong>Checking kitchen availability…</strong><p>This may take a few seconds.</p></>;
  else if(error && shortage){
    tone='stock';content=<><div className="stock-shortage-heading"><CalendarDays size={22} aria-hidden="true"/><div><strong>This basket isn’t available for the selected date</strong><p>Choose another date, adjust your basket or ask the kitchen to confirm availability.</p></div></div>
      <div className="availability-result-actions"><a className="availability-primary-action" href="#checkout-time">Change date or time</a><Link to="/cart">Edit basket</Link><Link to="/contact">Ask the kitchen</Link>{retryable&&onRetry&&<button type="button" onClick={onRetry}>Check availability again</button>}</div></>;
  }
  else if (error) { tone = 'error'; content = <><strong>Availability could not be confirmed</strong><p>{error}</p>{retryable&&onRetry&&<div className="availability-result-actions"><button type="button" onClick={onRetry}>Retry availability check</button></div>}</>; }
  else if (quote && quote.selectionKey !== selectionKey) content = <><strong>Please check availability again</strong><p>Your delivery time or basket has changed since the last check.</p></>;
  else if (quote?.plan.needs_review) {
    content = requestMode?<><strong>Kitchen confirmation needed</strong><p>You can send this time to the kitchen for review. No payment will be taken and no preparation time is reserved until confirmed.</p>{quote.plan.review_reason && <details><summary>Why kitchen confirmation is needed</summary><p>{quote.plan.review_reason}</p></details>}</>:<><strong>Choose another available time</strong><p>This time cannot be scheduled with the current kitchen bookings. Choose one of the suggested alternatives above, or ask the kitchen to review this time.</p></>;
  }
  else if (quote?.plan.ordering_mode==='simple') {
    tone='success';content=<><strong>Your selected date and time are available</strong><p>You can continue to place your preorder. Availability is checked again when you order.</p></>;
  }
  else if (quote) {
    tone = 'success';
    content = <><strong>Your requested time is available</strong><p>You can continue to place your preorder. Availability will be checked again when you order.</p>{quote.plan.procurement_required && <p><strong>Ingredients need purchasing.</strong> Kitchen time fits; the owner must source suitable stock before cooking.</p>}<details><summary>View preparation details</summary><PreparationDays plan={quote.plan}/><p>Preparation starts {new Date(quote.plan.preparation_at).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'})}. {quote.plan.hands_on_minutes} minutes of hands-on work.</p><p>{quote.plan.procurement_required ? 'The owner needs to purchase ingredients for this plan.' : 'Recorded ingredients cover this estimate; stock is not reserved until cooking.'}</p></details></>;
  }
  return <div id="availability-result" aria-live="polite" aria-atomic="true" aria-busy={checking}>{content && <div className={`availability-result availability-result--${tone}`} role={error ? 'alert' : 'status'}>{content}</div>}</div>;
}
