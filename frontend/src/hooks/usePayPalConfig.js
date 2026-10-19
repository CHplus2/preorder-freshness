import {useEffect,useState} from 'react';
import axios from 'axios';
import {paypalConfig} from '../utils/paypalResponse';
export default function usePayPalConfig(){
 const [config,setConfig]=useState(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get('/api/payments/paypal/config/',{signal:controller.signal,timeout:10000}).then(({data})=>{setConfig(paypalConfig(data));setError(false)}).catch(e=>{if(!axios.isCancel(e)){setConfig(null);setError(true)}});
  return()=>controller.abort();
 },[attempt]);
 return {config,error,retry:()=>{setError(false);setAttempt(n=>n+1)}};
}
