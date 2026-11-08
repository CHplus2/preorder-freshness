import {useRef,useState} from 'react';
import axios from 'axios';
import ModalDialog from './ModalDialog';
import {useAuth} from '../contexts/AuthContext';
import {useStorefront} from '../contexts/StorefrontContext';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {invalidResponse} from '../utils/apiResponse';
import {kitchenOrderContact,orderReference} from '../utils/kitchenOrderContact';
import './CustomerOrderCancellation.css';
const currentSession=()=>true;
export default function CustomerOrderCancellation({order,onCancelled,onSaved}){
 const {store}=useStorefront()||{};
 const isSessionCurrent=useAuth()?.isSessionCurrent||currentSession;
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const operation=useRef(false);
 if(order.ordering_mode!=='simple'||order.status!=='pending')return null;
 const cancel=async event=>{
  event.preventDefault();if(operation.current||!isSessionCurrent())return;
  operation.current=true;setBusy(true);setError('');
  const contact=kitchenOrderContact(store,order,{cancelled:true,reason});
  // Open from the user's click so mobile browsers can permit the later app handoff.
  let popup=null;
  if(contact.whatsapp){try{popup=window.open('about:blank','_blank');if(popup)popup.opener=null}catch{/* The success message retains a usable WhatsApp link. */}}
  try{
   const {data}=await axios.post(`/api/orders/${order.id}/cancel/`,{version:order.updated_at,reason},{timeout:20000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(!isSessionCurrent()){popup?.close();return}
   if(data?.id!==order.id||data.status!=='cancelled')throw invalidResponse();
   onCancelled?.({id:order.id,contact});setOpen(false);
   if(popup&&!popup.closed){try{popup.location.href=contact.whatsapp}catch{popup.close()}}
   try{await onSaved?.()}catch{/* Cancellation is confirmed; the persistent success message remains available. */}
  }catch(e){popup?.close();if(isSessionCurrent())setError(apiError(e)+' Refresh My orders to check its status before trying again.')}
  finally{operation.current=false;setBusy(false)}
 };
 return <><button type="button" className="customer-cancel-order" onClick={()=>{setError('');setOpen(true)}}>Cancel order</button>
  {open&&<ModalDialog label={`Cancel order ${orderReference(order.id)}`} onDismiss={()=>{if(!operation.current)setOpen(false)}} fallbackFocusSelector=".customer-orders-heading button"><div className="modal-overlay"><div className="modal-content customer-cancel-dialog">
   <h2>Cancel this order?</h2><p>Order #{orderReference(order.id)} will move to History. Cancellation does not issue a refund. The kitchen will review any payment and unused stock separately.</p>
   <form onSubmit={cancel}><label>Reason (optional)<textarea data-initial-focus rows="3" maxLength="300" disabled={busy} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <p className="customer-cancel-contact-note">{kitchenOrderContact(store,order).whatsapp?'After cancellation, WhatsApp opens with an order message. Review the draft and press Send there.':'After cancellation, use Contact the kitchen to discuss any payment or arrangements.'}</p>
    {error&&<p role="alert" className="customer-cancel-error">{error}</p>}
    <div className="customer-cancel-dialog-actions"><button type="button" disabled={busy} onClick={()=>setOpen(false)}>Keep order</button><button type="submit" className="customer-cancel-confirm" disabled={busy}>{busy?'Cancelling…':'Confirm cancellation'}</button></div>
   </form>
  </div></div></ModalDialog>}
 </>;
}
