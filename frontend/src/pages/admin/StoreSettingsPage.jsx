/* global __FRESHCAST_REVISION__ */
import QrSettingsControls from '../../components/QrSettingsControls';
import ReceivingQrUpload from '../../components/ReceivingQrUpload';
import {deliveryFeeError,deliverySettingsPayload} from '../../utils/deliveryAreaEditor';
import {deliveryAreasError} from '../../utils/deliveryAreas';
import CourierConnectionStatus from '../../components/CourierConnectionStatus';
import FulfilmentSettings from '../../components/FulfilmentSettings';
import {useUI} from '../../contexts/UIContext';
import './StoreSettingsPage.css';
import SetupChecklist from '../../components/SetupChecklist';
import BackupDownloads from '../../components/BackupDownloads';
import ReminderStatus from '../../components/ReminderStatus';
import {useEffect,useState} from 'react';
import axios from 'axios';
import {apiError} from '../../utils/apiError';
import {getCookie} from '../../utils/cookieUtils';
const groups=[
 {title:'Cooking hours & travel time',help:'Kitchen hours apply to preparation; collection and delivery have their own hours below. You can keep preparing after delivery closes, within kitchen hours. Work for later days must also fit each menu’s preparation span and waiting limits. Travel time applies to delivery only.',fields:[['kitchen_open_hour','Opens at (hour, 0-22)','number',0,22],['kitchen_close_hour','Closes at (hour, 1-23)','number',1,23],['delivery_buffer_minutes','Travel and contingency (minutes)','number',1,1440]]},
 {title:'Storefront identity',help:'The essentials customers see first.',fields:[['name','Kitchen name'],['founder_name','Owner name'],['tagline','Short introduction'],['service_area','Service area description','textarea'],['contact_email','Contact email','email'],['whatsapp_number','WhatsApp number including country code'],['social_url','Social media link','url']]},
 {title:'Your business story',help:'Tell customers who cooks their food and why you started. Use your real story and photos.',collapse:true,fields:[['story','Kitchen introduction','textarea'],['founder_intro','Owner introduction'],['founding_story','How your business started','textarea'],['food_philosophy','Your approach to food','textarea'],['signature_food','Signature food'],['founder_image_url','Owner photo URL','url']]},
 {title:'Manual payments',help:'Provide bank-transfer instructions or a DuitNow QR image to enable manual payments. These details are public when customers view your store. Use a business account. Verify incoming transfers in your bank before marking orders paid.',fields:[['bank_transfer_instructions','Bank name, account holder and payment instructions','textarea'],['duitnow_qr_url','DuitNow QR image URL','url']]},
 {title:'Bulk promotion',help:'Set the discount to 0 to switch off the promotion.',collapse:true,fields:[['bulk_minimum','Minimum portions','number',1,10000],['bulk_discount_percent','Discount (%)','number',0,50]]}
];
export default function StoreSettingsPage(){
 const {setAlert}=useUI();
 const [setupRevision,setSetupRevision]=useState(0);
 const [paymentError,setPaymentError]=useState('');
 const [areaError,setAreaError]=useState('');
 const [deliverySaving,setDeliverySaving]=useState(false);
 const [pickupError,setPickupError]=useState(''),[pickupSaving,setPickupSaving]=useState(false);
 const [store,setStore]=useState(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();axios.get('/api/storefront/',{signal:c.signal}).then(r=>setStore(r.data)).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))});return()=>c.abort()},[retry]);
 const settingsReady=Boolean(store);
 useEffect(()=>{
  const reveal=()=>{
   const id=window.location.hash.slice(1);
   if(!settingsReady && !['backups','reminders'].includes(id))return;
   if(!['store-identity','store-contact','promotions','backups','fulfilment','pickup-setup','shop-delivery-fee','reminders','courier','qr-payments'].includes(id))return;
   const target=document.getElementById(id);
   if(target){if(['courier','pickup-setup'].includes(target.id))target.setAttribute('tabindex','-1');if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'start'});(['backups','reminders','courier','pickup-setup'].includes(target.id)||target.matches('input,textarea')?target:target.querySelector('input,textarea'))?.focus({preventScroll:true});}
  };
  reveal();window.addEventListener('hashchange',reveal);
  return()=>window.removeEventListener('hashchange',reveal);
 },[settingsReady]);
 const save=async e=>{e.preventDefault();if(busy)return;setPaymentError('');setAreaError('');const areaIssue=store.ordering_mode==='simple'?deliveryFeeError(store):deliveryAreasError(store.delivery_areas || []);if(areaIssue){setMessage('');setAreaError(areaIssue);document.getElementById('delivery-area-names')?.focus();return;}if(store.manual_payment_enabled && !(store.bank_transfer_instructions?.trim()||store.duitnow_qr_url?.trim())){setMessage('');setPaymentError(store.ordering_mode==='simple'?'Add a receiving QR image or bank details, or switch this payment option off. Your other entries are kept.':'Add bank-transfer instructions or a DuitNow QR image, or switch manual payments off. Nothing has been saved yet; your other entries are retained.');document.getElementById('manual-payment-toggle')?.focus();return;}setBusy(true);setError('');setMessage('');try{const r=await axios.patch('/api/storefront/',store,{headers:{'X-CSRFToken':getCookie('csrftoken')}});setStore(r.data);setSetupRevision(n=>n+1);window.dispatchEvent(new Event('storefront-updated'));setMessage('Settings saved. Existing order schedules and delivery fees are unchanged.');setAlert({type:'success',message:'Settings saved.'});}catch(e){if(e.response?.data?.delivery_areas){setAreaError(apiError(e));document.getElementById('delivery-area-names')?.focus();}else setError(apiError(e));}finally{setBusy(false)}};
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
  setBusy(true);setPickupSaving(true);setMessage('');
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
  setAreaError('');setMessage('');
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
   <label htmlFor={fieldId}>{label}</label>{type==='textarea'?<textarea id={fieldId} disabled={busy} value={store[key] || ''} onChange={e=>setStore({...store,[key]:e.target.value})}/>:<input id={fieldId} disabled={busy} type={type} min={min} max={max} value={store[key] ?? ''} onChange={e=>setStore({...store,[key]:e.target.value})}/>}
  </div>;
 })}</div>{g.title==='Manual payments'&&store.ordering_mode==='simple'&&<QrSettingsControls store={store} onChange={next=>{setStore(next);setPaymentError('')}} onSave={saveQr} busy={busy} error={paymentError}/>}</>;

 return <main className="dk-workspace settings-page"><div className="admin-page-heading"><div><span className="admin-kicker">YOUR BUSINESS</span><h1>Settings</h1><p>Manage kitchen availability, storefront details, promotions and backups.</p><div className="settings-shortcuts" role="navigation" aria-label="Settings shortcuts"><a href="#setup">Kitchen setup checklist</a><a href="#fulfilment">Collection & delivery</a><a href="#pickup-setup">Pickup setup</a><a href="#shop-delivery-fee">Delivery areas &amp; fees</a><a href="#qr-payments">QR &amp; bank transfer</a><a href="#courier">Courier delivery</a><a href="#reminders">Email reminders & worker activity</a></div></div></div>{error && <div role="alert" className="admin-notice error">{error}{store?<p>Your edits are kept. Review them and save again.</p>:<button onClick={()=>{setError('');setRetry(n=>n+1)}}>Retry loading settings</button>}</div>}{!store && !error && <p role="status">Loading settings...</p>}{store && <form onSubmit={save} className="dk-settings">{groups.filter(g=>store.ordering_mode==='scheduled'||g.title!=='Cooking hours & travel time').map(g=>g.collapse?<details className="settings-group" id={g.title==='Bulk promotion'?'promotions':undefined} key={g.title}><summary>{g.title}</summary>{fields(g)}</details>:<section className="settings-group" id={g.title==='Storefront identity'?'store-identity':g.title==='Manual payments'?'qr-payments':undefined} key={g.title}><h2>{g.title==='Manual payments'&&store.ordering_mode==='simple'?'QR & bank transfer':g.title}</h2>{fields(g)}</section>)}<FulfilmentSettings store={store} onChange={next=>{setStore(next);setAreaError('');setPickupError('');}} disabled={busy} areaError={areaError} onSavePickup={savePickup} pickupSaving={pickupSaving} pickupError={pickupError} onSaveDelivery={saveDelivery} deliverySaving={deliverySaving}/>{store.ordering_mode==='scheduled'&&<><label className="settings-payment-toggle"><input id="manual-payment-toggle" disabled={busy} aria-describedby={paymentError?"manual-payment-error":undefined} aria-invalid={!!paymentError} type="checkbox" checked={!!store.manual_payment_enabled} onChange={e=>setStore({...store,manual_payment_enabled:e.target.checked})}/> {store.ordering_mode==='simple'?'Enable DuitNow QR payment at checkout':'Enable manual DuitNow / bank transfer at checkout'}</label>{paymentError && <p id="manual-payment-error" role="alert" className="settings-payment-error">{paymentError}</p>}</>}<div className="admin-toolbar settings-save-actions"><button className="admin-primary" disabled={busy}>{busy?'Saving...':'Save settings'}</button><span role="status">{message}</span></div></form>}<CourierConnectionStatus/><SetupChecklist key={setupRevision}/><ReminderStatus/><div className="settings-advanced"><h2>Advanced</h2><BackupDownloads/><p className="settings-version">Website version <code>{typeof __FRESHCAST_REVISION__==='string'?__FRESHCAST_REVISION__:'development'}</code> · Include this version when reporting a problem.</p></div></main>;
}
