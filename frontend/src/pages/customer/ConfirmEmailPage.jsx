import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import axios from 'axios';
import {useAuth} from '../../contexts/AuthContext';
import {useUI} from '../../contexts/UIContext';
import {getCookie} from '../../utils/cookieUtils';
import {apiError,readApiError} from '../../utils/apiError';
import {emailChangePreview,emailChangeSettings,emailChangeToken} from '../../utils/emailChange';
import PageLoading from '../../components/PageLoading';
import '../../components/AccountForms.css';
export default function ConfirmEmailPage(){
 const {isAuthenticated}=useAuth();const {hash}=useLocation();const {setShowLogin}=useUI();
 if(isAuthenticated===null)return <PageLoading label="Loading your account…"/>;
 if(!isAuthenticated)return <main className="recovery-page"><h1>Confirm your email change</h1><p>Sign in to the account that requested this change. Opening the link does not change your email.</p><button type="button" className="account-primary" onClick={()=>setShowLogin(true)}>Sign in to continue</button><Link to="/contact">Need help? Contact the kitchen</Link></main>;
 return <EmailChangeConfirmation key={hash} initialHash={hash}/>;
}
function EmailChangeConfirmation({initialHash}){
 const [token]=useState(()=>emailChangeToken(initialHash));const [preview,setPreview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[retry,setRetry]=useState(0);
 const request=useRef(null),errorRef=useRef(null),pending=useRef(false);const {logout}=useAuth();
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{
  if(!token)return;
  const controller=new AbortController();request.current=controller;
  axios.post('/api/account/email-change/confirm/',{token,action:'inspect'},{signal:controller.signal,timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}}).then(({data})=>{
   if(controller.signal.aborted)return;const value=emailChangePreview(data);setPreview(value);setDone(value.already_applied);
   if(window.location.hash)window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
  }).catch(error=>{if(!controller.signal.aborted)setError(readApiError(error,'The confirmation could not be checked.'));});
  return()=>controller.abort();
 },[token,retry]);
 useEffect(()=>{if(errorRef.current){errorRef.current.focus();errorRef.current.scrollIntoView({block:'nearest'});}},[error]);
 const confirm=async()=>{
  if(pending.current || !preview || done)return;
  pending.current=true;setBusy(true);setError('');const controller=new AbortController();request.current=controller;
  try{const {data}=await axios.post('/api/account/email-change/confirm/',{token,action:'confirm'},{signal:controller.signal,timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});const contact=emailChangeSettings(data);if(contact.email!==preview.proposed_email || typeof data.already_applied!=='boolean')throw Object.assign(new Error('Unexpected confirmation'),{code:'INVALID_RESPONSE'});setDone(true);}
  catch(error){if(!controller.signal.aborted)setError(!error.response || error.response.status>=500 || error.code==='INVALID_RESPONSE'?'The email change could not be confirmed. Retry this same confirmation, or check your current email in Account settings before requesting another link.':apiError(error));}
  finally{pending.current=false;if(!controller.signal.aborted)setBusy(false);}
 };
 return <main className="recovery-page"><span className="dk-eyebrow">ACCOUNT EMAIL</span><h1>{done?'Email change confirmed':'Confirm your email change'}</h1>
  {!token?<p role="alert" className="account-form-error">This link is incomplete. Request a new confirmation link in Account settings.</p>:<section className="recovery-card" aria-label="Email change confirmation">
   {error && <div className="account-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
   {!preview && !error && <p role="status">Checking the link for your signed-in account…</p>}
   {preview && (done?<><p role="status">Your account now uses <strong>{preview.proposed_email}</strong>. Use it next time you sign in.</p><p>Order reminders were not transferred. Choose them again in My orders if you want messages sent to this address.</p></>:<><p>Your current email stays unchanged until you confirm below.</p><dl className="email-change-comparison"><div><dt>Current email</dt><dd>{preview.current_email || 'Not set'}</dd></div><div><dt>New email</dt><dd>{preview.proposed_email}</dd></div></dl><p>This changes your sign-in and recovery email. Your account reference, password, orders and payment records stay the same.</p><button type="button" className="account-primary" disabled={busy} onClick={confirm}>{busy?'Confirming…':'Confirm new email'}</button></>)}
   {!preview && error && <div className="recovery-actions"><button type="button" onClick={()=>{setError('');setRetry(value=>value+1);}}>Check link again</button><button type="button" onClick={logout}>Use another account</button></div>}
  </section>}
  <div className="recovery-actions"><Link to="/account#delivery-email">Account email settings</Link><Link to="/orders">My orders</Link></div>
 </main>;
}
