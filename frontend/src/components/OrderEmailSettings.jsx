import {useEffect,useState} from 'react';
import axios from 'axios';
import {apiError} from '../utils/apiError';
import {getCookie} from '../utils/cookieUtils';
import {emailChangeSettings} from '../utils/emailChange';
import PasswordField from './PasswordField';

export default function OrderEmailSettings(){
 const [value,setValue]=useState(null),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[attempt,setAttempt]=useState(0),[draft,setDraft]=useState('');
 useEffect(()=>{const controller=new AbortController();axios.get('/api/account/order-email/',{signal:controller.signal,timeout:15000}).then(({data})=>{const settings=emailChangeSettings(data);setValue(settings);setDraft(settings.email);}).catch(e=>{if(!axios.isCancel(e))setError('Email settings could not be loaded. Please try again.');});return()=>controller.abort();},[attempt]);
 const needsConfirmation=value?.confirmationRequired && !!draft && draft.trim().toLowerCase()!==value.email.trim().toLowerCase();
 const save=async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const needsLink=value.confirmationRequired && !!draft && draft.trim().toLowerCase()!==value.email.trim().toLowerCase();
   const {data}=await axios({url:needsLink?'/api/account/email-change/':'/api/account/order-email/',method:needsLink?'post':'patch',data:{email:draft,current_password:password},timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   const settings=emailChangeSettings(data);if(needsLink && data.confirmation_sent!==true)throw Object.assign(new Error('Unverified send'),{code:'INVALID_RESPONSE'});setValue(settings);setPassword('');
   if(needsLink)setMessage('Confirmation email accepted for sending. Open the newest link within 30 minutes while signed in to this account. Your current email has not changed.');
   else{setDraft(settings.email);setMessage(settings.email?'Email saved. Use it next time you sign in. Choose reminders again on existing orders after changing your email.':'Email removed. Use your existing username or the account reference in Profile to sign in. Email recovery and reminders are unavailable without an email.');}
  }catch(e){setError(!e.response || e.response.status>=500 || e.code==='INVALID_RESPONSE'?'This email request could not be confirmed. Check your inbox and current email in Account settings before retrying. Your entries are still here.':apiError(e));}finally{setBusy(false);}
 };
 const cancel=async()=>{
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{const {data}=await axios.post('/api/account/email-change/cancel/',{},{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});setValue(emailChangeSettings(data));setMessage('Outstanding confirmation links cancelled. Your current email has not changed.');}
  catch(error){setError(!error.response || error.response.status>=500?'Cancellation could not be confirmed. Refresh Account settings before retrying.':apiError(error));}finally{setBusy(false);}
 };
 return <section className="checkout-section" id="delivery-email" aria-labelledby="order-email-heading"><h2 id="order-email-heading">Sign-in email & delivery reminders</h2><p>Use this email to sign in, recover your password and choose optional order reminders. Reminders are selected per order; adding an email does not subscribe old orders.</p>{error && <p role="alert" className="customer-notice">{error}</p>}{value?<form onSubmit={save}><fieldset disabled={busy} className="account-fields"><label>Email address (optional)<input type="email" autoComplete="email" maxLength={254} value={draft} onChange={e=>{setDraft(e.target.value);setMessage('');}}/></label><PasswordField label="Current password" name="current_password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></fieldset><div className="checkout-actions"><button className="checkout-submit" disabled={busy || (needsConfirmation && !value.confirmationAvailable)}>{busy?'Please wait…':value.confirmationRequired && draft && draft.trim().toLowerCase()!==value.email.trim().toLowerCase()?'Send confirmation link':'Save email'}</button></div>{!value.available && <p>Email reminders are currently unavailable. {value.confirmationRequired?'Your current email stays usable.':'You can save your email now.'}</p>}{value.confirmationRequired && <p>Current email: <strong>{value.email || 'Not set'}</strong>. A different address is saved only after you confirm its email link. Removing an email still requires your password.</p>}{value.confirmationRequired && !value.confirmationAvailable && <p>Email confirmation is temporarily unavailable. Keep using your current email or try again later.</p>}<p role="status">{message}</p>{value.pending && <div className="account-email-pending"><p>An email-change request is outstanding. Only the newest link works; it expires after 30 minutes.</p><button type="button" disabled={busy} onClick={cancel}>Cancel pending email change</button></div>}{!value.email && <p>Without an email, use your existing username or the account reference in Profile to sign in. Email recovery and reminders are unavailable.</p>}</form>:<>{!error && <p role="status">Loading email settings…</p>}{error && <button type="button" onClick={()=>{setError('');setAttempt(n=>n+1);}}>Try loading again</button>}</>}</section>;
}
