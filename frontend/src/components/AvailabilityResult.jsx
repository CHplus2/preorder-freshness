export default function AvailabilityResult({checking, error, quote, selectionKey}) {
  let content = null;
  let tone = 'pending';
  if (checking) content = <><strong>Checking kitchen availability…</strong><p>This may take a few seconds.</p></>;
  else if (error) { tone = 'error'; content = <><strong>Availability could not be confirmed</strong><p>{error}</p></>; }
  else if (quote && quote.selectionKey !== selectionKey) content = <><strong>Please check availability again</strong><p>Your delivery time or basket has changed since the last check.</p></>;
  else if (quote?.plan.needs_review) {
    content = <><strong>Kitchen confirmation needed</strong><p>You can submit this preorder for owner review. No payment will be taken. The owner will confirm your requested time or contact you to arrange another time.</p></>;
  }
  else if (quote) {
    tone = 'success';
    content = <><strong>✓ Your requested time is available</strong><p>You can continue to place your preorder. Availability will be checked again when you order.</p><details><summary>View preparation details</summary><p>Preparation starts {new Date(quote.plan.preparation_at).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur'})}. {quote.plan.hands_on_minutes} minutes of hands-on work.</p><p>{quote.plan.procurement_required ? 'The owner needs to purchase ingredients for this plan.' : 'Recorded ingredients cover this estimate; stock is not reserved until cooking.'}</p></details></>;
  }
  return <div id="availability-result" aria-live="polite" aria-atomic="true" aria-busy={checking}>{content && <div className={`availability-result availability-result--${tone}`} role={error ? 'alert' : 'status'}>{content}</div>}</div>;
}
