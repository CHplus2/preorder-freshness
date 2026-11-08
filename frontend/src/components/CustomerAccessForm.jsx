import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {useUI} from '../contexts/UIContext';
import {passkeysSupported,passkeyError} from '../utils/passkeys';
import ContactPhoneField from './ContactPhoneField';
import {ArrowRight} from 'lucide-react';
import './CustomerAccess.css';
export default function CustomerAccessForm({initialMode='create',initialName='',initialPhone='',checkout=false,onComplete,onStaffSignIn}){
 const {isAuthenticated,authPending,authError,clearAuthError,startGuest,passkeyAction,isSessionCurrent}=useAuth();
 const {setAlert}=useUI();
 const [mode,setMode]=useState(initialMode),[name,setName]=useState(initialName),[phone,setPhone]=useState(initialPhone),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef(false),errorRef=useRef(null),root=useRef(null),supported=passkeysSupported(),create=mode==='create';
 useEffect(()=>{if(error||authError){errorRef.current?.focus();errorRef.current?.scrollIntoView({block:'nearest'});}},[error,authError]);
 useEffect(()=>{root.current?.querySelector('[data-initial-focus]')?.focus()},[mode]);
 const submit=async event=>{
  event.preventDefault();if(pending.current||authPending)return;
  pending.current=true;setBusy(true);setError('');
  try{
   await passkeyAction(create?'register':'signin',create?{name,phone,label:'My passkey'}:{});
   setAlert({type:'success',message:create?'Account created. Your basket and orders are saved.':'Signed in successfully.'});
   onComplete?.();
  }catch(e){if(isSessionCurrent())setError(passkeyError(e));}
  finally{pending.current=false;if(isSessionCurrent())setBusy(false);}
 };
 const switchMode=()=>{setError('');clearAuthError?.();setMode(create?'signin':'create')};
 return <div ref={root} className="customer-access-form"><h2>{create?'Create your account':'Login'}</h2><p>{create?'Save your orders with your name and phone number.':'Sign in using your saved passkey.'}</p>
  <p className="customer-access-help">Use your fingerprint, face or device PIN. No email, password or SMS needed.</p>
  {!supported&&<p role="status" className="account-message">Use a browser that supports passkeys and open this website over HTTPS.</p>}
  {(error||authError)&&<div ref={errorRef} tabIndex={-1} role="alert" className="account-message account-error">{error||authError}{authError&&isAuthenticated===false&&<button type="button" disabled={authPending} onClick={startGuest}>Try again</button>}</div>}
  <form onSubmit={submit}><fieldset disabled={busy||authPending||create&&isAuthenticated!==true}><legend className="sr-only">{create?'Create customer account':'Customer sign in'}</legend>
   {create&&<><label>Your name<input data-initial-focus required autoComplete="name" maxLength="150" value={name} onChange={e=>setName(e.target.value)}/></label><ContactPhoneField value={phone} onChange={setPhone}/><p className="customer-access-help">Use your full number, for example 011 1234 5678 or +60 11 1234 5678.</p></>}
   <button className="customer-access-primary" data-initial-focus={!create?true:undefined} type="submit" disabled={!supported||busy||authPending||create&&isAuthenticated!==true}>{busy||authPending?'Confirming…':create?'Register':'Login'}</button>
  </fieldset></form>
  {checkout&&<p className="customer-access-help">{create?'Your current basket stays with your new account.':'Logging in loads your saved basket.'}</p>}
  <p className="customer-access-switch"><span>{create?'Already have an account?':'New here?'}</span><button type="button" disabled={busy||authPending} onClick={switchMode}>{create?'Login':'Register'}<ArrowRight size={15} aria-hidden="true"/></button></p>
  <details className="customer-access-help"><summary>Using another device?</summary><p>Use a synced passkey or your browser’s “Use another device” option. Keep a backup passkey: your name and phone number alone cannot recover the account.</p></details>
  {onStaffSignIn&&<div className="customer-access-staff"><span>Manage this kitchen?</span><button type="button" disabled={busy||authPending} onClick={()=>onStaffSignIn({mode,name,phone})}>Kitchen staff sign in<ArrowRight size={15} aria-hidden="true"/></button></div>}
 </div>;
}
