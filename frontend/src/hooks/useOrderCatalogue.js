import {useEffect,useState} from 'react';
import axios from 'axios';
import {costCatalogue} from '../utils/costResponse';
import {readApiError} from '../utils/apiError';

// Unknown catalogue status must never silently hide an order.
export default function useOrderCatalogue(refreshKey=0) {
 const [catalogue,setCatalogue]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setCatalogue(null);setError('');
  axios.get('/api/products/',{signal:controller.signal,timeout:30000})
   .then(({data})=>{if(!controller.signal.aborted)setCatalogue(costCatalogue(data));})
   .catch(e=>{if(!axios.isCancel(e))setError(readApiError(e));});
  return()=>controller.abort();
 },[refreshKey,attempt]);
 return {catalogue,error,retry:()=>setAttempt(value=>value+1)};
}
