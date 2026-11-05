import {useCallback,useEffect, useState} from 'react';
import axios from 'axios';
import {readApiError} from '../utils/apiError';

export default function useClientReport(url, validate) {
 const [result, setResult] = useState({key:null, data:null, error:''});
 const [version, setVersion] = useState(0);
 const refresh=useCallback(()=>setVersion(value=>value+1),[]);
 useEffect(()=>{
  let timer;
  const onReturn=()=>{if(document.visibilityState==='hidden')return;clearTimeout(timer);timer=setTimeout(refresh,150)};
  window.addEventListener('focus',onReturn);document.addEventListener('visibilitychange',onReturn);
  return()=>{clearTimeout(timer);window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn)};
 },[refresh]);
 const key = `${url}#${version}`;
 useEffect(() => {
  const controller = new AbortController();
  axios.get(url, {signal:controller.signal, timeout:20000})
   .then(({data}) => {if (!controller.signal.aborted) setResult({key, data:validate(data), loadedAt:new Date(), error:''});})
   .catch(error => {if (!controller.signal.aborted) setResult({key, data:null, error:readApiError(error)});});
  return () => controller.abort();
 }, [url, key, validate]);
 return {...(result.key === key ? result : {data:null, error:''}), loading:result.key !== key,
  refresh};
}
