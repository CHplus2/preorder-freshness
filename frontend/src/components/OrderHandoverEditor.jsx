import {useState} from 'react';
import axios from 'axios';
import HandoverFields from './HandoverFields';
import {handoverDetails} from '../utils/handover';
import {apiError} from '../utils/apiError';
import {invalidResponse} from '../utils/apiResponse';
import {getCookie} from '../utils/cookieUtils';
export default function OrderHandoverEditor({order,onSaved}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(()=>handoverDetails(order)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!['pending','processing','cooked'].includes(order.status))return null;
 const save=async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{const {data}=await axios.patch(`/api/orders/${order.id}/handover/`,{handover:value,version:order.updated_at},{timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});if(data?.order?.id!==order.id || !data.order.fulfilment_snapshot?.handover)throw invalidResponse();setOpen(false);onSaved?.();}catch(e){setError(!e.response || e.response.status>=500 || e.code==='INVALID_RESPONSE'?'We could not confirm the handover details. Your entries are still here. Refresh My orders to check the saved details.':apiError(e));}finally{setBusy(false);}};
 return <div className="handover-editor"><button type="button" aria-expanded={open} onClick={()=>{setValue(handoverDetails(order));setError('');setOpen(v=>!v);}} disabled={busy}>{open?'Close handover details':'Change contact & handover'}</button>{open && <form onSubmit={save}><HandoverFields value={value} onChange={setValue} pickup={order.delivery_method==='pickup'} disabled={busy}/><button disabled={busy}>{busy?'Saving…':'Save handover details'}</button>{error && <p role="alert">{error}</p>}<p>Changes apply to this order. Contact the kitchen directly if a courier is already on the way.</p></form>}</div>;
}
