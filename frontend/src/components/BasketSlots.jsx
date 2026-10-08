import {responseSlots} from '../utils/apiResponse';
import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
export default function BasketSlots({value,onSelect,disabled=false}){
  const [slots,setSlots]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[checked,setChecked]=useState('');
  const day=value.slice(0,10);
  const check=async()=>{if(!day || busy || disabled)return;setBusy(true);setError('');setSlots([]);setChecked('');try{const r=await axios.post('/api/orders/slots/',{date:day},{headers:{'X-CSRFToken':getCookie('csrftoken')}});setSlots(responseSlots(r.data));setChecked(day)}catch(e){setError(apiError(e))}finally{setBusy(false)}};
  return <div className="slot-suggestions"><button type="button" disabled={!day || busy || disabled} onClick={check}>{busy?'Finding times…':'Suggest times for this basket'}</button>{error && <p role="alert">{error} Use “Suggest times for this basket” to retry.</p>}{!disabled && checked && checked===day && <>{slots.length===0?<p>No hourly slots found for this basket on this date. Try a smaller basket or contact the kitchen to review preparation and delivery options. A later date alone may not resolve recipe timing limits.</p>:<><p>Suggested times, rechecked at checkout:</p>{slots.map(s=><button type="button" key={s.delivery_at} onClick={()=>onSelect(new Date(Date.parse(s.delivery_at)+8*3600000).toISOString().slice(0,16))}>{new Date(s.delivery_at).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'})}</button>)}</>}</>}</div>
}
