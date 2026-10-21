import {useCallback,useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {checkoutAddress} from '../utils/checkoutPresentation';
import {emptyAddress} from '../utils/customerExperience';
import {apiError,readApiError} from '../utils/apiError';
import {getCookie} from '../utils/cookieUtils';

export default function useCheckoutAddress(){
 const [address,setAddress]=useState(null),[draft,setDraft]=useState(emptyAddress),[editing,setEditing]=useState(false),[addressLoading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[attempt,setAttempt]=useState(0);
 const submitting=useRef(false);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get('/api/address/',{signal:controller.signal,timeout:30000}).then(({data})=>{if(controller.signal.aborted)return;const next=checkoutAddress(data,true);setAddress(next);setDraft(next || {...emptyAddress});setEditing(!next);})
   .catch(error=>{if(!controller.signal.aborted)setError(readApiError(error));})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[attempt]);
 const retry=()=>{setError('');setLoading(true);setAddress(null);setEditing(false);setAttempt(n=>n+1);};
 const change=()=>{setDraft(address || {...emptyAddress});setEditing(true);setSaved(false);setError('');};
 const cancel=()=>{if(submitting.current)return;setDraft(address);setEditing(false);setError('');};
 const save=async event=>{
  event.preventDefault();if(submitting.current)return;
  submitting.current=true;setSaving(true);setError('');setSaved(false);
  try{const {data}=await axios.put('/api/address/',draft,{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});const next=checkoutAddress(data);setAddress(next);setDraft(next);setEditing(false);setSaved(true);}
  catch(error){setError(!error.response || error.response.status>=500 || error.code==='INVALID_RESPONSE'?'The address save could not be confirmed. Your entries are still here. Reload checkout to check the saved address before retrying.':apiError(error));}
  finally{submitting.current=false;setSaving(false);}
 };
 const edit=useCallback((key,value)=>{setSaved(false);setDraft(previous=>({...previous,[key]:value}));},[]);
 return {address,draft,editing,addressLoading,saving,error,saved,retry,change,cancel,save,edit};
}
