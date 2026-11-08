import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import axios from 'axios';
import {getCookie} from '../../utils/cookieUtils';
import {accountConfirmation,accountRequestError,resetCredentials} from '../../utils/accountForms';
import {useUI} from '../../contexts/UIContext';
import PasswordField from '../../components/PasswordField';
import PageLoading from '../../components/PageLoading';
import PasswordRecoveryRequest from '../../components/PasswordRecoveryRequest';
import {useAuth} from '../../contexts/AuthContext';
import {useStorefront} from '../../contexts/StorefrontContext';
import '../../components/AccountForms.css';

export default function RecoveryPage(){
  const {isAuthenticated}=useAuth();
  const {hash}=useLocation();
  // Account isolation remounts pages once the initial session check completes.
  // Wait before consuming a one-use reset fragment so that remount cannot lose it.
  return isAuthenticated===null?<PageLoading label="Loading account help…"/>:<RecoveryContent key={hash} initialHash={hash}/>;
}
function RecoveryContent({initialHash}){
  // Reading is pure: StrictMode may call initializers twice before mounting.
  const [credentials,setCredentials]=useState(()=>resetCredentials(initialHash));
  const [form,setForm]=useState({password:'',confirm:''}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false);
  const {setShowLogin,openCustomerAccess}=useUI();
  const simple=useStorefront()?.store?.ordering_mode==='simple';
  const errorRef=useRef(null),submitting=useRef(false);
  const reset=credentials.uid!==null || credentials.token!==null;
  const completeLink=Boolean(credentials.uid && credentials.token && credentials.uid.length<=100 && credentials.token.length<=150);
  useEffect(()=>{if(window.location.hash)window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);},[]);
  useEffect(()=>{if(errorRef.current){errorRef.current.focus();errorRef.current.scrollIntoView({block:'nearest'});}},[error]);
  const edit=key=>event=>{setForm(previous=>({...previous,[key]:event.target.value}));setError('');};
  const startOver=()=>{setCredentials({uid:null,token:null});setForm({password:'',confirm:''});setError('');setMessage('');setDone(false);};
  const submit=async event=>{
    event.preventDefault();if(submitting.current || !completeLink)return;
    setError('');setMessage('');
    if(form.password!==form.confirm){setError('Passwords do not match. Re-enter the confirmation password.');return;}
    submitting.current=true;setBusy(true);
    try{
      const {data}=await axios.post('/api/auth/recovery/confirm/',{...credentials,password:form.password},{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
      setMessage(accountConfirmation(data));
      setDone(true);setForm({password:'',confirm:''});
    }catch(error){setError(accountRequestError(error,'reset'));}
    finally{submitting.current=false;setBusy(false);}
  };
  return <main className="recovery-page"><span className="dk-eyebrow">ACCOUNT HELP</span><h1>{done?'Password updated':reset?'Choose a new password':simple?'Staff password recovery':'Recover your account'}</h1><p>{reset?'Use a password you haven’t used for this kitchen account before.':simple?'For kitchen staff with a saved account email. Customer accounts use a passkey instead of a password.':'Enter the email saved with your account. If it belongs to more than one older account, include your username below. Accounts without an email need help from the kitchen.'}</p>
    {simple&&!reset&&<section className="recovery-passkey-help"><h2>Customer sign-in</h2><p>Use a saved or synced passkey, or your browser’s option to use another device. Your name and phone number alone cannot restore account access.</p><button type="button" onClick={()=>openCustomerAccess({mode:'signin',next:'/account'})}>Sign in with a passkey</button></section>}
    <section className="recovery-card" aria-label="Password recovery">
      {message && <p className="recovery-message" role="status">{message}</p>}
      {error && <div className="account-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
      {!reset?<PasswordRecoveryRequest onBusyChange={setBusy}/>:!completeLink?<p className="account-form-error" role="alert">This reset link is incomplete. Request a new reset link below.</p>:!done&&<form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy} className="account-form-fields"><PasswordField label="New password" name="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={edit('password')} hintId="reset-password-hint"/><p className="account-form-hint" id="reset-password-hint">At least 8 characters. Avoid common passwords, only numbers, or a password similar to your name or email.</p><PasswordField label="Confirm password" name="confirm" required autoComplete="new-password" value={form.confirm} onChange={edit('confirm')}/></fieldset>
        <button className="account-primary" disabled={busy}>{busy?'Please wait…':'Update password'}</button>
      </form>}
    </section>
    <div className="recovery-actions">{reset && !done && <button type="button" disabled={busy} onClick={startOver}>Request a new reset link</button>}<button type="button" disabled={busy} onClick={()=>setShowLogin(true)}>Back to sign in</button><Link to="/contact">Contact the kitchen</Link></div>
  </main>;
}
