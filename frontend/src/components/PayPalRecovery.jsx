import './PayPalRecovery.css';

export default function PayPalRecovery({recovery,paymentStatus,busy,onCheck}){
 if(!recovery)return null;
 const canCheck=recovery.configured && recovery.has_provider_order && paymentStatus!=='refunded';
 return <section className="paypal-recovery" aria-label="PayPal payment recovery">
  <div className="paypal-recovery-heading"><span className="paypal-recovery-badge">PayPal Sandbox</span><h4>Verify the saved payment</h4></div>
  <p>Check PayPal’s records for this preorder. This does not charge the customer or create another payment.</p>
  {paymentStatus==='refunded'?<p>A refund is already recorded. Review the ledger and PayPal activity before making further changes.</p>:<>
   {!recovery.has_provider_order?<p>The customer has not started a PayPal payment session. They can continue from My orders.</p>:!recovery.configured?<p>PayPal Sandbox is currently unavailable. Restore the payment settings before checking.</p>:<button type="button" disabled={busy} onClick={onCheck}>{busy?'Checking PayPal…':'Check PayPal status'}</button>}
   {canCheck && <p className="paypal-recovery-note">A verified completed capture updates the receipt automatically. Cooking and delivery status stay separate.</p>}
  </>}
  {recovery.checked_at && <p className="paypal-recovery-note">Last verified check: {new Date(recovery.checked_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})} (Malaysia){recovery.checked_via==='notification'?' · PayPal notification':recovery.checked_via==='owner'?' · Owner check':''}.</p>}
  {recovery.check_error && <p className="paypal-recovery-warning">The latest check needs follow-up. Check again or review PayPal activity before recording another payment.</p>}
 </section>;
}
