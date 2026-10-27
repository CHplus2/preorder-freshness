import {useEffect,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {emailCheckResult,emailCheckReason} from '../utils/emailDelivery';
export default function EmailDeliveryCheck({configuration}){
 const [busy,setBusy]=useState(false),[result,setResult]=useState(null),[message,setMessage]=useState(''),[wait,setWait]=useState(0);
 useEffect(()=>{if(!wait)return;const timer=setTimeout(()=>setWait(value=>Math.max(0,value-1)),1000);return()=>clearTimeout(timer)},[wait]);
 const send=async()=>{
  if(busy || wait || !configuration.test_available)return;
  setBusy(true);setResult(null);setMessage('');
  try{
   const response=await axios.post('/api/admin/email-delivery-check/',{},{headers:{'X-CSRFToken':getCookie('csrftoken')},timeout:45000});
   setResult(emailCheckResult(response.data,configuration.owner_recipient,response.status));setWait(300);
  }catch(error){
   if(error.response?.status===503 && error.response?.data?.reference){
    try{setResult(emailCheckResult(error.response.data,configuration.owner_recipient,503));setWait(300);}
    catch{setMessage('The test result could not be verified. Check the recipient inbox and provider logs before another attempt.');setWait(300);}
   }else if(error.response?.status===429){setMessage('A test was requested recently. Check its inbox result before trying again.');setWait(300);}
   else if([401,403].includes(error.response?.status))setMessage('Sign in again as the owner and refresh this page before requesting the check.');
   else if(error.response?.status===503)setMessage('The email check is not available with the current server configuration. Refresh reminder status to review it.');
   else{setMessage('The test result could not be confirmed. Check the recipient inbox for “FreshCast email check” before trying again.');setWait(300);}
  }finally{setBusy(false);}
 };
 return <section className="email-delivery-check" aria-labelledby="email-delivery-check-title">
  <h3 id="email-delivery-check-title">Check email delivery</h3>
  <p>These are the current owner-email settings. Earlier worker totals combine owner and customer messages and do not identify their recipient.</p>
  <dl><dt>Owner recipient · OWNER_NOTIFICATION_EMAIL</dt><dd>{configuration.owner_recipient || 'Missing or invalid'}</dd><dt>Sender · DEFAULT_FROM_EMAIL</dt><dd>{configuration.sender_address || 'Missing or invalid — use a provider-approved sender'}</dd></dl>
  {!configuration.transport_ready && <p>Configure the SMTP host and SMTP email backend before sending.</p>}
  <button type="button" disabled={busy || wait>0 || !configuration.test_available} onClick={send}>{busy?'Sending one test…':'Send one test email to owner'}</button>
  <p>This button sends one message to the owner recipient shown above. It does not process orders or start the reminder worker. One attempt per staff account every five minutes.</p>
  {wait>0 && <p>Another test is available after the cooldown. Check the current result first.</p>}
  {message && <p role="alert">{message}</p>}
  {result && <div role="status" className="email-check-result"><strong>{result.outcome==='accepted'?'Test accepted by the email provider':result.outcome==='not_accepted'?'Test was not accepted':'Test result is unconfirmed'}</strong>
   <p>{result.outcome==='accepted'?'Search the owner recipient’s Inbox, Spam and All Mail for this reference. Provider acceptance is not proof of inbox receipt.':emailCheckReason(result.reason)}</p>
   <p>Recipient: {result.recipient}</p><p>Search reference: <code>{result.reference}</code></p>
   <p>If it is still missing, check your sending provider’s delivery or bounce records. Rerunning an order reminder will not normally resend an event already recorded as accepted.</p>
  </div>}
 </section>;
}
