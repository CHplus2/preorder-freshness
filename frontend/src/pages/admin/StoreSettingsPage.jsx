/* global __FRESHCAST_REVISION__ */
import QrSettingsControls from '../../components/QrSettingsControls';
import ReceivingQrUpload from '../../components/ReceivingQrUpload';
import {deliverySettingsPayload} from '../../utils/deliveryAreaEditor';
import {deliveryAreasError} from '../../utils/deliveryAreas';
import CourierConnectionStatus from '../../components/CourierConnectionStatus';
import FulfilmentSettings from '../../components/FulfilmentSettings';
import {useUI} from '../../contexts/UIContext';
import {useAuth} from '../../contexts/AuthContext';
import {settingsPayload,savedSettings,revealSettingsTarget} from '../../utils/settingsWorkspace';
import SettingsDisclosure from '../../components/SettingsDisclosure';
import './StoreSettingsPage.css';
import SetupChecklist from '../../components/SetupChecklist';
import BackupDownloads from '../../components/BackupDownloads';
import ReminderStatus from '../../components/ReminderStatus';
import {useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {apiError} from '../../utils/apiError';
import {getCookie} from '../../utils/cookieUtils';
const groups=[
 {key:'cooking',title:'Cooking hours & travel time',help:'Kitchen hours apply to preparation; collection and delivery have their own hours below. You can keep preparing after delivery closes, within kitchen hours. Work for later days must also fit each menu’s preparation span and waiting limits. Travel time applies to delivery only.',fields:[['kitchen_open_hour','Opens at (hour, 0-22)','number',0,22],['kitchen_close_hour','Closes at (hour, 1-23)','number',1,23],['delivery_buffer_minutes','Travel and contingency (minutes)','number',1,1440]]},
 {key:'identity',title:'Storefront identity',help:'The essentials customers see first.',fields:[['name','Kitchen name'],['founder_name','Owner name'],['tagline','Short introduction'],['service_area','Service area description','textarea'],['contact_email','Contact email','email'],['whatsapp_number','WhatsApp number including country code'],['social_url','Social media link','url']]},
 {key:'story',title:'Your business story',help:'Tell customers who cooks their food and why you started. Use your real story and photos.',collapse:true,fields:[['story','Kitchen introduction','textarea'],['founder_intro','Owner introduction'],['founding_story','How your business started','textarea'],['food_philosophy','Your approach to food','textarea'],['signature_food','Signature food'],['founder_image_url','Owner photo URL','url']]},
 {key:'payments',title:'Manual payments',help:'Provide bank-transfer instructions or a receiving bank QR image to enable manual payments. These details are public when customers view your store. Use receiving details approved for your business. Verify incoming transfers in your bank before marking orders paid.',fields:[['bank_transfer_instructions','Bank name, account holder and payment instructions','textarea'],['duitnow_qr_url','Receiving bank QR image URL','url']]},
 {key:'promotion',title:'Bulk promotion',help:'Set the discount to 0 to switch off the promotion.',collapse:true,fields:[['bulk_minimum','Minimum selling units','number',1,10000],['bulk_discount_percent','Discount (%)','number',0,50]]}
];
export default function StoreSettingsPage(){
 const {setAlert}=useUI();
 const {isSessionCurrent}=useAuth();
 const writing=useRef(false),feedback=useRef(null);
 const [sectionError,setSectionError]=useState(null),[savedSection,setSavedSection]=useState('');
 const [setupRevision,setSetupRevision]=useState(0);
 const [paymentError,setPaymentError]=useState('');
 const [areaError,setAreaError]=useState('');
 const [deliverySaving,setDeliverySaving]=useState(false);
 const [pickupError,setPickupError]=useState(''),[pickupSaving,setPickupSaving]=useState(false);
 const [store,setStore]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();axios.get('/api/storefront/',{signal:c.signal}).then(r=>setStore(r.data)).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))});return()=>c.abort()},[retry]);
 const settingsReady=Boolean(store);
 useEffect(()=>{
  const reveal=()=>{const id=window.location.hash.slice(1);if(settingsReady||['backups','reminders'].includes(id))revealSettingsTarget(id)};
  reveal();window.addEventListener('hashchange',reveal);return()=>window.removeEventListener('hashchange',reveal);
 },[settingsReady]);
 useEffect(()=>{if(sectionError){feedback.current?.focus();feedback.current?.scrollIntoView({block:'nearest'})}},[sectionError]);
 const save=async(event,group)=>{
  event.preventDefault();if(writing.current||busy)return;
  const key=group.key;setSectionError(null);setSavedSection('');
  if(key==='fulfilment'){const issue=deliveryAreasError(store.delivery_areas||[]);if(issue){setAreaError(issue);revealSettingsTarget('delivery-area-names');return}}
  if(key==='payments'&&store.manual_payment_enabled&&!store.bank_transfer_instructions?.trim()&&!store.duitnow_qr_url?.trim()){setPaymentError('Add a receiving QR image or bank details before enabling payment.');return}
  writing.current=true;setBusy(true);
  try{
   const payload=settingsPayload(key,store),keys=Object.keys(payload);
   const {data}=await axios.patch('/api/storefront/',payload,{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   const next=savedSettings(store,data,keys);if(!isSessionCurrent())return;
   setStore(current=>savedSettings(current,next,keys));setSetupRevision(value=>value+1);setSavedSection(key);
   window.dispatchEvent(new Event('storefront-updated'));setAlert({type:'success',message:`${group.title} saved.`});
  }catch(error){if(isSessionCurrent())setSectionError({key,message:!error.response||error.response.status>=500?'The save could not be confirmed. Your entries are kept. Refresh Settings to check before retrying.':apiError(error)})}
  finally{writing.current=false;setBusy(false)}
 };
 const saveQr=async()=>{
  if(busy)return;
  setPaymentError('');
  if(store.manual_payment_enabled&&!store.duitnow_qr_url?.trim()&&!store.bank_transfer_instructions?.trim()){
   setPaymentError('Add a receiving QR image or bank-transfer details before enabling payment. Collection requires a QR image.');return;
  }
  const keys=['manual_payment_enabled','duitnow_qr_url','bank_transfer_instructions'];
  const payload={manual_payment_enabled:!!store.manual_payment_enabled,duitnow_qr_url:(store.duitnow_qr_url||'').trim(),bank_transfer_instructions:(store.bank_transfer_instructions||'').trim()};
  setBusy(true);
  try{
   const {data}=await axios.patch('/api/storefront/',payload,{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(data?.manual_payment_enabled!==payload.manual_payment_enabled||data.duitnow_qr_url!==payload.duitnow_qr_url)throw new Error('Unexpected QR settings response');
   setStore(current=>({...current,...Object.fromEntries(keys.map(key=>[key,data[key]]))}));
   setSetupRevision(value=>value+1);window.dispatchEvent(new Event('storefront-updated'));
   setAlert({type:'success',message:'Payment settings saved.'});
  }catch(error){setPaymentError(!error.response||error.response.status>=500?'QR settings could not be confirmed. Refresh Settings to check the saved configuration.':apiError(error));}
  finally{setBusy(false)}
 };
 const savePickup=async enabled=>{
  if(busy)return;
  setPickupError('');
  if(enabled && !store.pickup_location?.trim()){
   setPickupError('Enter a collection address to enable pickup.');document.getElementById('pickup-location')?.focus();return;
  }
  const keys=['pickup_enabled','pickup_location','pickup_instructions',...(store.ordering_mode==='simple'?['pickup_start_time','pickup_end_time']:['pickup_open_hour','pickup_close_hour'])];
  const payload=enabled?Object.fromEntries(keys.map(key=>[key,key==='pickup_enabled'?true:store[key]])):{pickup_enabled:false};
  setBusy(true);setPickupSaving(true);
  try{
   const {data}=await axios.patch('/api/storefront/',payload,{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(data?.pickup_enabled!==enabled || enabled && !data.pickup_location?.trim())throw new Error('Unverified pickup settings');
   setStore(current=>({...current,...Object.fromEntries((enabled?keys:['pickup_enabled']).map(key=>[key,data[key]]))}));
   setSetupRevision(n=>n+1);window.dispatchEvent(new Event('storefront-updated'));
   setAlert({type:'success',message:enabled?'Self-collection settings saved.':'Self-collection turned off.'});
  }catch(error){
   setPickupError(!error.response || error.response.status>=500?'Could not confirm the change. Reload Settings to check pickup availability.':apiError(error,'Pickup settings could not be saved.'));
  }finally{setBusy(false);setPickupSaving(false);}
 };
 const saveDelivery=async()=>{
  if(busy)return;
  setAreaError('');
  let payload;
  try{payload=store.ordering_mode==='simple'?deliverySettingsPayload(store):Object.fromEntries(['delivery_areas','delivery_area_fees','delivery_fee_myr','free_delivery_minimum_myr'].map(key=>[key,store[key]]));}
  catch(error){setAreaError(error.message);document.getElementById('shop-delivery-fee')?.scrollIntoView({block:'center'});return;}
  const keys=Object.keys(payload);
  setBusy(true);setDeliverySaving(true);
  try{
   const {data}=await axios.patch('/api/storefront/',payload,{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(store.ordering_mode==='simple'?JSON.stringify(deliverySettingsPayload(data))!==JSON.stringify(payload):!Array.isArray(data.delivery_areas)||!data.delivery_area_fees)throw new Error('Invalid delivery settings response');
   setStore(current=>({...current,...Object.fromEntries(keys.map(key=>[key,data[key]]))}));
   setSetupRevision(n=>n+1);window.dispatchEvent(new Event('storefront-updated'));
   setAlert({type:'success',message:store.ordering_mode==='simple'?'Delivery settings saved.':'Delivery areas and fees saved.'});
  }catch(error){setAreaError(!error.response||error.response.status>=500?'Could not confirm the saved delivery settings. Reload Settings to check them before trying again.':apiError(error,'Delivery settings could not be saved.'));}
  finally{setBusy(false);setDeliverySaving(false)}
 };
 const fields=g=><><p>{store.ordering_mode==='simple'&&g.title==='Manual payments'?'Add your business receiving QR image and/or bank account instructions, then enable payment below. A QR image is required for self-collection. Customers upload a receipt at checkout; verify it against your bank records before recording payment.':g.help}</p><div className="admin-fields">{g.fields.map(([key,label,type='text',min,max])=>{
  if(key==='duitnow_qr_url')return <ReceivingQrUpload key={key} value={store.duitnow_qr_url} disabled={busy} onChange={value=>setStore({...store,duitnow_qr_url:value})}/>;
  const fieldId=key==='service_area'?'store-contact':'setting-'+key;
  return <div className="settings-field" key={key} style={type==='textarea'?{gridColumn:'1 / -1'}:undefined}>
   <label htmlFor={fieldId}>{label}</label>{type==='textarea'?<textarea id={fieldId} disabled={busy} value={store[key] || ''} onChange={e=>(setSavedSection(''),setStore({...store,[key]:e.target.value}))}/>:<input id={fieldId} disabled={busy} type={type} required={key==='name'} min={min} max={max} value={store[key] ?? ''} onChange={e=>(setSavedSection(''),setStore({...store,[key]:e.target.value}))}/>}
  </div>;
 })}</div>{g.title==='Manual payments'&&store.ordering_mode==='simple'&&<QrSettingsControls store={store} onChange={next=>{setStore(next);setPaymentError('')}} onSave={saveQr} busy={busy} error={paymentError}/>}</>;

 const groupId=key=>({identity:'store-identity',payments:'qr-payments',promotion:'promotions',story:'business-story',cooking:'cooking-hours'}[key]);
 const groupForm=group=><form onSubmit={event=>save(event,group)} className="settings-section-form">
  {fields(group)}
  {group.key==='payments'&&store.ordering_mode==='scheduled'&&<><label className="settings-payment-toggle"><input id="manual-payment-toggle" type="checkbox" disabled={busy} checked={!!store.manual_payment_enabled} onChange={event=>setStore({...store,manual_payment_enabled:event.target.checked})}/>Enable bank QR / transfer at checkout</label>{paymentError&&<p role="alert" className="settings-field-error">{paymentError}</p>}</>}
  {sectionError?.key===group.key&&<p ref={feedback} tabIndex={-1} role="alert" className="settings-field-error">{sectionError.message}</p>}
  {!(group.key==='payments'&&store.ordering_mode==='simple')&&<footer className="settings-section-save"><button className="admin-primary" type="submit" disabled={busy}>{busy?'Saving…':group.key==='identity'?'Save kitchen profile':group.key==='story'?'Save business story':group.key==='promotion'?'Save bulk promotion':'Save these settings'}</button><span role="status">{savedSection===group.key?'Saved.':''}</span></footer>}
 </form>;
 return <main className="dk-workspace settings-page"><div className="admin-page-heading"><div><span className="admin-kicker">YOUR BUSINESS</span><h1>Settings</h1><p>Update your kitchen details, ordering options and customer-facing information. Save each section separately.</p></div></div>
  <nav className="settings-shortcuts" aria-label="Settings shortcuts"><a href="#store-identity">Kitchen profile</a><a href="#fulfilment">Collection &amp; delivery</a><a href="#qr-payments">Payments</a><a href="#reminders">Email reminders</a><a href="#setup">Setup checks</a></nav>
  {error&&<div role="alert" className="admin-notice error"><p>{error}</p><button type="button" onClick={()=>{setError('');setRetry(value=>value+1)}}>Retry loading settings</button></div>}
  {!store&&!error&&<p role="status">Loading settings…</p>}
  {store&&<div className="dk-settings">
   {groups.filter(group=>store.ordering_mode==='scheduled'||group.key!=='cooking').map(group=><SettingsDisclosure key={group.key} id={groupId(group.key)} title={group.key==='identity'?'Kitchen profile':group.key==='payments'?'QR & bank transfer':group.title} description={group.key==='identity'?'Name, contact details and service area':group.key==='story'?'Your story and owner introduction':group.key==='payments'?'Receiving QR, bank instructions and payment availability':group.key==='promotion'?'A quantity discount for new orders':'Hours used by preparation planning'} defaultOpen={group.key==='identity'} lazy>{groupForm(group)}</SettingsDisclosure>)}
   <SettingsDisclosure id="collection-settings" title="Collection & delivery" description="Pickup availability, hours, delivery areas and fees">
    <FulfilmentSettings store={store} onChange={next=>{setStore(next);setAreaError('');setPickupError('')}} disabled={busy} areaError={areaError} onSavePickup={savePickup} pickupSaving={pickupSaving} pickupError={pickupError} onSaveDelivery={saveDelivery} deliverySaving={deliverySaving}/>
    {store.ordering_mode==='scheduled'&&<form onSubmit={event=>save(event,{key:'fulfilment',title:'Collection & delivery'})}><button className="admin-primary" type="submit" disabled={busy}>Save collection &amp; delivery</button>{sectionError?.key==='fulfilment'&&<p ref={feedback} role="alert" tabIndex={-1} className="settings-field-error">{sectionError.message}</p>}</form>}
   </SettingsDisclosure>
  </div>}
  <SettingsDisclosure id="reminders" title="Email reminders" description="Kitchen reminders, test email and sending history" lazy><ReminderStatus embedded/></SettingsDisclosure>
  <SettingsDisclosure id="setup" title="Kitchen setup checks" description="Review saved menus, stock and ordering settings" lazy><SetupChecklist key={setupRevision} embedded/></SettingsDisclosure>
  <SettingsDisclosure id="courier-tools" title="Courier handover" description="Booking and coordinating a delivery"><CourierConnectionStatus/></SettingsDisclosure>
  <SettingsDisclosure id="advanced-settings" title="Backups & website information" description="Recovery downloads and website version"><BackupDownloads/><p className="settings-version">Website version <code>{typeof __FRESHCAST_REVISION__==='string'?__FRESHCAST_REVISION__:'development'}</code></p></SettingsDisclosure>
 </main>;
}
