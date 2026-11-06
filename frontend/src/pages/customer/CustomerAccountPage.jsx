import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import axios from 'axios';
import {useAuth} from '../../contexts/AuthContext';
import {useUI} from '../../contexts/UIContext';
import {getCookie} from '../../utils/cookieUtils';
import {passkeysSupported,passkeyError} from '../../utils/passkeys';
import ContactPhoneField from '../../components/ContactPhoneField';
import ModalDialog from '../../components/ModalDialog';
import {accountPasskeys} from '../../utils/accountPasskeys';
import './CustomerAccountPage.css';

export default function CustomerAccountPage(){
 const {customerAccount,isAdmin,isAuthenticated,authPending}=useAuth(),{setShowLogin,openCustomerAccess}=useUI(),[params]=useSearchParams();
 const destination=['checkout','orders','cart'].includes(params.get('next'))?'/'+params.get('next'):null;
 const opened=useRef(false);
 useEffect(()=>{if(isAuthenticated!==null&&!authPending&&!customerAccount&&!isAdmin&&!opened.current){opened.current=true;openCustomerAccess({next:destination||'/account'})}},[isAuthenticated,authPending,customerAccount,isAdmin,openCustomerAccess,destination]);
 if(isAdmin)return <main className="customer-account"><h1>Kitchen account</h1><Link to="/admin/orders">Open kitchen orders</Link></main>;
 if(!customerAccount)return <main className="customer-account"><header><h1>Your account</h1><p>Save your orders with your name, phone number and a passkey. No email or password needed.</p></header><button type="button" onClick={()=>openCustomerAccess({next:destination||'/account'})}>Create account or sign in</button><div className="account-footer-links"><Link to="/menu">Browse the menu</Link><button className="account-secondary" type="button" onClick={()=>setShowLogin(true)}>Kitchen staff sign in</button></div></main>;
 return <CustomerAccountDetails/>;
}
function CustomerAccountDetails(){
 const {customerAccount,isAuthenticated,isAdmin,authPending,passkeyAction,isSessionCurrent,checkAuth}=useAuth();
 const {setAlert}=useUI(),navigate=useNavigate(),[params]=useSearchParams();
 const destination=['checkout','orders','cart'].includes(params.get('next'))?'/'+params.get('next'):null;
 const [name,setName]=useState(customerAccount?.name||''),[phone,setPhone]=useState(customerAccount?.phone||'');
 const [label,setLabel]=useState('My passkey'),[keys,setKeys]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 const supported=passkeysSupported();
 const [keysError,setKeysError]=useState(''),[removing,setRemoving]=useState(null);
 const feedback=useRef(null);
 useEffect(()=>{if(error){feedback.current?.focus();feedback.current?.scrollIntoView({block:'nearest'})}},[error]);
 const [savedContact,setSavedContact]=useState(customerAccount);
 if(customerAccount&&(customerAccount.name!==savedContact?.name||customerAccount.phone!==savedContact?.phone)){setSavedContact(customerAccount);setName(customerAccount.name);setPhone(customerAccount.phone)}
 useEffect(()=>{
  if(!customerAccount)return;
  const controller=new AbortController();
  axios.get('/api/account/customer/',{signal:controller.signal,timeout:15000}).then(({data})=>{
   if(controller.signal.aborted||!isSessionCurrent())return;
   setKeys(accountPasskeys(data));setKeysError('');
  }).catch(e=>{if(!controller.signal.aborted&&isSessionCurrent())setKeysError(passkeyError(e));});
  return()=>controller.abort();
 },[customerAccount,isSessionCurrent,attempt]);
 const run=async work=>{if(busy||authPending)return;setBusy(true);setError('');try{await work()}catch(e){if(isSessionCurrent())setError(passkeyError(e))}finally{if(isSessionCurrent())setBusy(false)}};
 const register=event=>{event.preventDefault();run(async()=>{
  if(customerAccount)await passkeyAction('reauth');
  await passkeyAction('register',{name,phone,label});
  setAlert({type:'success',message:'Passkey saved. Your basket and orders are linked to your account.'});
  if(destination)navigate(destination);
 })};
 const save=event=>{event.preventDefault();run(async()=>{
  await passkeyAction('reauth');
  await axios.patch('/api/account/customer/',{name,phone},{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
  await checkAuth();setAlert({type:'success',message:'Contact details saved. Existing order details stay as agreed.'});
 })};
 const remove=id=>run(async()=>{
  await passkeyAction('reauth');
  await axios.delete(`/api/account/passkeys/${id}/`,{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
  await checkAuth();setRemoving(null);setAttempt(n=>n+1);setAlert({type:'success',message:'Passkey removed. Devices using it will be signed out.'});
 });
 if(isAdmin)return <main className="customer-account"><h1>Kitchen account</h1><Link to="/admin/orders">Open kitchen orders</Link></main>;
 return <main className="customer-account"><header><h1>{customerAccount?'Your account':'Save your orders with a passkey'}</h1><p>{customerAccount?'Your contact details and secure sign-in.':'Use your fingerprint, face, device PIN or security key. No email, password or SMS needed.'}</p></header>
  {!supported&&<p className="account-message" role="status">Passkeys need a supported browser and a secure connection. Open this website over HTTPS.</p>}
  {error&&!removing&&<p ref={feedback} tabIndex={-1} className="account-message account-error" role="alert">{error}</p>}
  <section className="customer-account-card"><h2>{customerAccount?'Contact details':'Create your account'}</h2>
   <form onSubmit={customerAccount?save:register}><fieldset disabled={busy||authPending||isAuthenticated!==true}><legend className="sr-only">Customer details</legend><div className="account-contact-grid"><label>Your name<input required autoComplete="name" maxLength="150" value={name} onChange={e=>setName(e.target.value)}/></label><ContactPhoneField value={phone} onChange={setPhone}/></div><p className="account-help">The kitchen uses this number for your orders. Your passkey secures sign-in; the phone number is not verified by SMS.</p><p className="account-help">Saving contact changes asks for your passkey. Existing orders keep their saved details.</p>
    <button disabled={!supported||isAuthenticated!==true} type="submit">{busy||authPending?'Confirming…':customerAccount?'Save contact details':'Create account with a passkey'}</button>
   </fieldset></form>
   {!customerAccount&&<p className="account-help">Your current basket and orders will stay with this account. Keep access to your saved passkey: a name or phone number cannot recover the account.</p>}
  </section>
  {customerAccount&&<section className="customer-account-card"><h2>Your passkeys</h2><p>Add a backup passkey before replacing a device. Removing a passkey signs out devices that used it; keep at least one.</p>
   {keysError?<div className="account-message account-error" role="alert"><p>Passkeys could not be loaded. Your saved passkeys have not changed.</p><button className="account-secondary" type="button" disabled={busy||authPending} onClick={()=>{setKeysError('');setKeys(null);setAttempt(value=>value+1)}}>Retry loading passkeys</button></div>:keys===null?<p role="status">Loading passkeys…</p>:<ul className="customer-passkeys">{keys.map(key=><li key={key.id}><div><strong>{key.label}</strong><small>Added {new Date(key.created_at).toLocaleDateString('en-MY')}</small></div><button className="account-secondary" disabled={keys.length<=1||busy||authPending} type="button" onClick={()=>{setError('');setRemoving(key)}}>Remove<span className="sr-only"> {key.label}</span></button></li>)}</ul>}
   {keys?.length===1&&<p className="account-help">Keep at least one passkey. Add a backup before removing this one.</p>}
   <details className="account-backup-key"><summary>Add a backup passkey</summary><form onSubmit={register}><label>Passkey name<input required maxLength="80" value={label} onChange={e=>setLabel(e.target.value)}/></label><button disabled={!supported||busy||authPending||!keys||keys.length>=5} type="submit">Add another passkey</button></form></details>
  </section>}
  {removing&&<ModalDialog label="Remove passkey" onDismiss={()=>{if(!busy&&!authPending)setRemoving(null)}}><div className="modal-overlay"><form className="modal-content account-key-dialog" onSubmit={event=>{event.preventDefault();remove(removing.id)}}><h2>Remove this passkey?</h2><p><strong>{removing.label}</strong></p><p>Devices using this passkey will be signed out. Keep access to another saved passkey before continuing.</p>{error&&<p ref={feedback} tabIndex={-1} role="alert" className="account-message account-error">{error}</p>}<footer><button type="button" className="account-secondary" disabled={busy||authPending} onClick={()=>setRemoving(null)}>Keep passkey</button><button className="account-key-remove" type="submit" disabled={busy||authPending}>{busy||authPending?'Confirming…':'Remove passkey'}</button></footer></form></div></ModalDialog>}
  <div className="account-footer-links">{destination&&customerAccount&&<Link to={destination}>Continue to {destination.slice(1)}</Link>}<Link to="/menu">Browse the menu</Link><Link to="/orders">My orders</Link></div>
 </main>;
}
