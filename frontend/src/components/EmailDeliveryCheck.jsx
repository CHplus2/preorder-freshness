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
  <h3 id="email-delivery-check-title">Test email</h3>
  <p>Send a test to check your kitchen’s email connection.</p>
  <dl><dt>Your reminders go to</dt><dd>{configuration.owner_recipient || 'Not set'}</dd><dt>Sent from</dt><dd>{configuration.sender_address || 'Not set — add a sender approved by your email provider'}</dd></dl>
  {!configuration.transport_ready && <p>Email sending needs setup before you can run a test.</p>}
  <button type="button" disabled={busy || wait>0 || !configuration.test_available} onClick={send}>{busy?'Sending test…':'Send test email'}</button>
  <p>Sends one message to the address above. Wait five minutes between tests.</p>
  {wait>0 && <p>Check your inbox before sending another test.</p>}
  {message && <p role="alert">{message}</p>}
  {result && <div role="status" className="email-check-result"><strong>{result.outcome==='accepted'?'Test email accepted for sending':result.outcome==='not_accepted'?'Test was not accepted':'Test result is unconfirmed'}</strong>
   <p>{result.outcome==='accepted'?'Search your Inbox, Spam and All Mail for this reference. Inbox delivery is not confirmed.':emailCheckReason(result.reason)}</p>
   <p>Recipient: {result.recipient}</p><p>Search reference: <code>{result.reference}</code></p>
   <p>Still missing? Check delivery or bounce records with your email provider.</p>
  </div>}
 </section>;
}
