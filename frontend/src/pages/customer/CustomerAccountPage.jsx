import {useEffect,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import axios from 'axios';
import {useAuth} from '../../contexts/AuthContext';
import {useUI} from '../../contexts/UIContext';
import {getCookie} from '../../utils/cookieUtils';
import {passkeysSupported,passkeyError} from '../../utils/passkeys';
import './CustomerAccountPage.css';

export default function CustomerAccountPage(){
 const {customerAccount,isAuthenticated,isAdmin,authPending,passkeyAction,isSessionCurrent,checkAuth}=useAuth();
 const {setAlert}=useUI(),navigate=useNavigate(),[params]=useSearchParams();
 const destination=['checkout','orders','cart'].includes(params.get('next'))?'/'+params.get('next'):null;
 const [name,setName]=useState(customerAccount?.name||''),[phone,setPhone]=useState(customerAccount?.phone||'');
 const [label,setLabel]=useState('My passkey'),[keys,setKeys]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 const supported=passkeysSupported();
 useEffect(()=>{if(customerAccount){setName(customerAccount.name);setPhone(customerAccount.phone)}},[customerAccount?.name,customerAccount?.phone]);
 useEffect(()=>{
  if(!customerAccount)return;
  const controller=new AbortController();
  axios.get('/api/account/customer/',{signal:controller.signal,timeout:15000}).then(({data})=>{
   if(controller.signal.aborted||!isSessionCurrent())return;
   if(!Array.isArray(data.passkeys))throw new Error('Account details are unavailable.');
   setKeys(data.passkeys);
  }).catch(e=>{if(!controller.signal.aborted&&isSessionCurrent())setError(passkeyError(e));});
  return()=>controller.abort();
 },[customerAccount,isSessionCurrent,attempt]);
 const run=async work=>{if(busy||authPending)return;setBusy(true);setError('');try{await work()}catch(e){if(isSessionCurrent())setError(passkeyError(e))}finally{if(isSessionCurrent())setBusy(false)}};
 const register=event=>{event.preventDefault();run(async()=>{
  if(customerAccount)await passkeyAction('reauth');
  await passkeyAction('register',{name,phone,label});
  setAlert({type:'success',message:'Passkey saved. Your basket and orders are linked to your account.'});
  if(destination)navigate(destination);
 })};
 const signin=()=>run(async()=>{await passkeyAction('signin');setAlert({type:'success',message:'Signed in with your passkey.'});if(destination)navigate(destination)});
 const save=event=>{event.preventDefault();run(async()=>{
  await passkeyAction('reauth');
  await axios.patch('/api/account/customer/',{name,phone},{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
  await checkAuth();setAlert({type:'success',message:'Contact details saved. Existing order details stay as agreed.'});
 })};
 const remove=id=>run(async()=>{
  await passkeyAction('reauth');
  await axios.delete(`/api/account/passkeys/${id}/`,{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
  await checkAuth();setAttempt(n=>n+1);setAlert({type:'success',message:'Passkey removed. Devices using it will be signed out.'});
 });
 if(isAdmin)return <main className="customer-account"><h1>Kitchen account</h1><Link to="/admin/orders">Open kitchen orders</Link></main>;
 return <main className="customer-account"><header><h1>{customerAccount?'Your account':'Save your orders with a passkey'}</h1><p>{customerAccount?'Your contact details and secure sign-in.':'Use your fingerprint, face, device PIN or security key. No email, password or SMS needed.'}</p></header>
  {!supported&&<p className="account-message" role="status">Passkeys need a supported browser and a secure connection. Open this website over HTTPS.</p>}
  {error&&<p className="account-message account-error" role="alert">{error}</p>}
  {!customerAccount&&<section className="customer-account-card"><h2>Already have an account?</h2><p>Choose your saved passkey. On another device, use a synced passkey or your browser’s “Use another device” option.</p><button type="button" disabled={!supported||busy||authPending} onClick={signin}>Sign in with a passkey</button></section>}
  <section className="customer-account-card"><h2>{customerAccount?'Contact details':'Create your account'}</h2>
   <form onSubmit={customerAccount?save:register}><fieldset disabled={busy||authPending||isAuthenticated!==true}><legend className="sr-only">Customer details</legend><div className="account-contact-grid"><label>Your name<input required autoComplete="name" maxLength="150" value={name} onChange={e=>setName(e.target.value)}/></label><label>Phone number<input required type="tel" autoComplete="tel" maxLength="30" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 012 345 6789"/></label></div><p className="account-help">The kitchen uses your phone number to coordinate orders. It does not receive a sign-in code.</p>
    <button disabled={!supported||isAuthenticated!==true} type="submit">{busy||authPending?'Confirming…':customerAccount?'Save contact details':'Create account with a passkey'}</button>
   </fieldset></form>
   {!customerAccount&&<p className="account-help">Your current basket and orders will stay with this account. Keep access to your saved passkey: a name or phone number cannot recover the account.</p>}
  </section>
  {customerAccount&&<section className="customer-account-card"><h2>Your passkeys</h2><p>Add a backup passkey before replacing a device. Removing a passkey signs out devices that used it; keep at least one.</p>
   {keys===null?<p role="status">Loading passkeys…</p>:<ul className="customer-passkeys">{keys.map(key=><li key={key.id}><div><strong>{key.label}</strong><small>Added {new Date(key.created_at).toLocaleDateString('en-MY')}</small></div><button className="account-secondary" disabled={keys.length<=1||busy||authPending} type="button" onClick={()=>remove(key.id)}>Remove<span className="sr-only"> {key.label}</span></button></li>)}</ul>}
   <form onSubmit={register}><label>Passkey name<input required maxLength="80" value={label} onChange={e=>setLabel(e.target.value)}/></label><button disabled={!supported||busy||authPending||!keys||keys.length>=5} type="submit">Add another passkey</button></form>
  </section>}
  <div className="account-footer-links">{destination&&customerAccount&&<Link to={destination}>Continue to {destination.slice(1)}</Link>}<Link to="/menu">Browse the menu</Link><Link to="/orders">My orders</Link></div>
 </main>;
}
