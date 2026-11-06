import OrderEmailSettings from '../../components/OrderEmailSettings';
import ContactPhoneField from '../../components/ContactPhoneField';
import {useEffect,useRef,useState} from 'react';
import {useUI} from '../../contexts/UIContext';
import {Link,useLocation} from 'react-router-dom';
import axios from 'axios';
import {apiError,readApiError} from '../../utils/apiError';
import {accountDetails} from '../../utils/customerExperience';
import {getCookie} from '../../utils/cookieUtils';
import {useCart} from '../../contexts/CartContext';
import {useAuth} from '../../contexts/AuthContext';
import {useStorefront} from '../../contexts/StorefrontContext';
import './CheckoutPage.css';
import './CustomerExperience.css';
import './KitchenAccount.css';

const states=['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Labuan','Putrajaya'];
function AccountSection({title,url,address=false,intro,children}){
  const {setAlert}=useUI();
  const feedback=useRef(null);
  const [value,setValue]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{if(error){feedback.current?.focus();feedback.current?.scrollIntoView({block:'nearest'})}},[error]);
  useEffect(()=>{
    const controller=new AbortController();
    axios.get(url,{signal:controller.signal,timeout:30000})
      .then(({data})=>setValue(accountDetails(data,address,true)))
      .catch(error=>{if(!axios.isCancel(error))setError(readApiError(error));});
    return()=>controller.abort();
  },[url,address,revision]);
  const edit=next=>{setValue(next);setMessage('');};
  const save=async event=>{
    event.preventDefault();if(busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      const {data}=await axios({url,method:address?'put':'patch',data:value,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
      setValue(accountDetails(data,address));setMessage(`${title} saved.`);setAlert({type:'success',message:`${title} saved.`});
    }catch(error){
      setError(!error.response || error.response.status>=500 || error.code==='INVALID_RESPONSE'
        ?'We could not confirm the save. Your entries are still here. Reload this page to check the saved details before trying again.'
        :apiError(error));
    }finally{setBusy(false);}
  };
  return <section className="checkout-section" aria-labelledby={address?'address-heading':'profile-heading'}>
    <h2 tabIndex={-1} id={address?'address-heading':'profile-heading'}>{title}</h2>
    <p className="account-section-intro">{intro||(address?'Your default for future checkouts. Orders already placed keep their original address.':'Keep your name ready for your next order. Sign in with your account email or your existing username.')}</p>
    {error && <p ref={feedback} tabIndex={-1} className="customer-notice" role="alert">{error}</p>}
    {!value?<><p role="status">{error?'These details are unavailable.':'Loading your details…'}</p>{error && <button type="button" onClick={()=>{setError('');setRevision(n=>n+1);}}>Try loading again</button>}</>:<form onSubmit={save}>
      <fieldset disabled={busy} className="account-fields">{children(value,edit)}</fieldset>
      <div className="checkout-actions"><button className="checkout-submit" disabled={busy}>{busy?'Saving…':`Save ${title.toLowerCase()}`}</button><span role="status">{message}</span></div>
    </form>}
  </section>;
}
export default function AccountPage(){
 const {isAdmin}=useAuth(),{store}=useStorefront()||{};
 if(isAdmin&&store?.ordering_mode==='simple')return <KitchenAccount/>;
 return <LegacyAccount/>;
}
function KitchenAccount(){
 return <main className="checkout-container account-settings kitchen-account"><header className="customer-page-heading"><span className="dk-eyebrow">KITCHEN WORKSPACE</span><h1>Your staff account</h1><p>Your staff profile and sign-in details. Business settings are managed separately.</p><nav className="customer-shortcuts" aria-label="Kitchen account shortcuts"><Link to="/admin/orders">Orders</Link><Link to="/admin/settings">Kitchen settings</Link></nav></header><div className="account-sections">
  <AccountSection title="Staff profile" url="/api/account/" intro="Save your name and phone for checkout. Your staff sign-in details stay the same.">{(value,edit)=><>
   <dl className="kitchen-signin-reference"><dt>Staff sign-in</dt><dd>{value.username}</dd></dl>
   <div className="address-fields">{['first_name','last_name'].map((key,i)=><label key={key}>{i?'Last name':'First name'}<input maxLength={150} autoComplete={i?'family-name':'given-name'} value={value[key]} onChange={e=>edit({...value,[key]:e.target.value})}/></label>)}<ContactPhoneField required={false} label="Phone number (optional)" value={value.phone||''} onChange={phone=>edit({...value,phone})}/></div>
  </>}</AccountSection>
  <section className="checkout-section"><h2>Kitchen delivery reminders</h2><p className="account-section-intro">Check the recipient, send a test email and see reminder activity in Kitchen settings.</p><p className="account-help">The kitchen’s reminder recipient and email sender are separate from your sign-in email. An empty account email does not switch off kitchen reminders.</p><Link className="customer-order-help" to="/admin/settings#reminders">Open email reminder settings</Link></section>
  <details className="kitchen-account-security"><summary>Sign-in email &amp; recovery (optional)</summary><OrderEmailSettings staff/></details>
 </div></main>;
}
function LegacyAccount(){
  const {hash}=useLocation();
  useEffect(()=>{
    if(!['#profile-heading','#address-heading','#delivery-email'].includes(hash))return;
    const target=document.getElementById(hash.slice(1));
    if(target){target.setAttribute('tabindex','-1');target.scrollIntoView({block:'start'});target.focus({preventScroll:true});}
  },[hash]);
  const {cart,cartError,cartLoading}=useCart();
  return <main className="checkout-container account-settings">
    <header className="customer-page-heading"><span className="dk-eyebrow">YOUR ACCOUNT</span><h1>Account settings</h1><p>Keep your name and delivery details ready for your next order.</p><nav className="customer-shortcuts" aria-label="Account shortcuts"><Link to="/orders">My orders</Link><Link to="/menu">Browse the menu</Link>{!cartLoading && !cartError && cart.length>0 && <Link to="/checkout">Continue to checkout</Link>}</nav></header>
    <nav className="account-section-links" aria-label="Account sections"><a href="#profile-heading">Profile</a><a href="#address-heading">Delivery address</a><a href="#delivery-email">Sign-in email & reminders</a></nav>
    <div className="account-sections"><AccountSection title="Profile" url="/api/account/">{(value,edit)=><div className="address-fields"><details className="field-wide account-reference"><summary>Account reference & existing username</summary><p>{value.username}</p><p>Your existing username still works. New accounts can use their email to sign in.</p></details>{['first_name','last_name'].map((key,i)=><label key={key}>{i?'Last name':'First name'}<input maxLength={150} autoComplete={i?'family-name':'given-name'} value={value[key]} onChange={e=>edit({...value,[key]:e.target.value})}/></label>)}</div>}</AccountSection>
    <AccountSection title="Delivery address" url="/api/address/" address>{(value,edit)=><div className="address-fields">{[['recipient_name','Recipient name','name'],['phone','Phone number','tel'],['line1','Street address','address-line1'],['line2','Apartment, floor or unit (optional)','address-line2'],['city','City','address-level2'],['postal_code','Postcode','postal-code']].map(([key,label,auto])=><label key={key} className={key==='line1' || key==='line2'?'field-wide':undefined}>{label}<input type={key==='phone'?'tel':'text'} autoComplete={auto} required={key!=='line2'} pattern={key==='postal_code'?'[0-9]{5}':undefined} inputMode={key==='postal_code'?'numeric':undefined} maxLength={key==='postal_code'?5:key==='phone'?20:150} value={value[key]} onChange={e=>edit({...value,[key]:e.target.value})}/></label>)}<label>State / territory<select required value={value.state} onChange={e=>edit({...value,state:e.target.value})}><option value="">Choose a state</option>{states.map(state=><option key={state}>{state}</option>)}</select></label><label>Country<input value={value.country} readOnly/></label></div>}</AccountSection><OrderEmailSettings/></div>
    <p className="account-help">Need to change an order already placed? <Link to="/orders">Open My orders</Link> to review its delivery details or contact the kitchen.</p>
  </main>;
}
