import {useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {accountConfirmation,accountRequestError} from '../utils/accountForms';
import './AccountForms.css';

export default function PasswordRecoveryRequest({initialEmail='',initialUsername='',onBusyChange}){
 const [email,setEmail]=useState(initialEmail),[username,setUsername]=useState(initialUsername);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [sharedEmail,setSharedEmail]=useState(Boolean(initialUsername));
 const pending=useRef(false),request=useRef(null),emailInput=useRef(null),errorBox=useRef(null);
 useEffect(()=>{emailInput.current?.focus();return()=>request.current?.abort()},[]);
 useEffect(()=>{if(error){errorBox.current?.focus();errorBox.current?.scrollIntoView({block:'nearest'})}},[error]);
 const submit=async event=>{
  event.preventDefault();if(pending.current)return;
  pending.current=true;setBusy(true);onBusyChange?.(true);setError('');setMessage('');
  const controller=new AbortController();request.current=controller;
  try{
   const {data}=await axios.post('/api/auth/recovery/',{email,username},
    {signal:controller.signal,timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(!controller.signal.aborted){accountConfirmation(data);setMessage('If the details match, a reset link will be sent. Check your inbox and spam folder.')}
  }catch(error){if(!controller.signal.aborted)setError(accountRequestError(error,'recovery'))}
  finally{pending.current=false;if(!controller.signal.aborted)setBusy(false);onBusyChange?.(false)}
 };
 return <div className="password-recovery-request">
  {message&&<p className="recovery-message" role="status">{message}</p>}
  {error&&<div ref={errorBox} tabIndex={-1} className="account-form-error" role="alert">{error}</div>}
  <form onSubmit={submit} aria-label="Password recovery" aria-busy={busy}>
   <fieldset disabled={busy} className="account-form-fields">
    <label>Account email<input ref={emailInput} required type="email" maxLength={254} autoComplete="email" value={email} onChange={event=>{setEmail(event.target.value);setError('')}}/></label>
    <details className="recovery-legacy" open={sharedEmail} onToggle={event=>setSharedEmail(event.currentTarget.open)}><summary>Using a shared email on an older account?</summary><p>Add the username for the account you want to recover.</p><label>Existing username (optional)<input maxLength={150} autoComplete="username" value={username} onChange={event=>{setUsername(event.target.value);setError('')}}/></label></details>
   </fieldset>
   <button className="account-primary" type="submit" disabled={busy}>{busy?'Sending…':message?'Resend':'Send'}</button>
  </form>
 </div>;
}
