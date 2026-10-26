import {useEffect,useState} from 'react';
import axios from 'axios';
import {costCatalogue} from '../utils/costResponse';
import {readApiError} from '../utils/apiError';

// Unknown catalogue status must never silently hide an order. Scope responses
// to the refresh that requested them, without cascading effect-time resets.
export default function useOrderCatalogue(refreshKey=0) {
 const [snapshot,setSnapshot]=useState(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get('/api/products/',{signal:controller.signal,timeout:30000})
   .then(({data})=>{if(!controller.signal.aborted)setSnapshot({refreshKey,attempt,catalogue:costCatalogue(data),error:''});})
   .catch(e=>{if(!controller.signal.aborted)setSnapshot({refreshKey,attempt,catalogue:null,error:readApiError(e)});});
  return()=>controller.abort();
 },[refreshKey,attempt]);
 const current=snapshot?.refreshKey===refreshKey && snapshot.attempt===attempt?snapshot:null;
 return {catalogue:current?.catalogue ?? null,error:current?.error || '',retry:()=>setAttempt(value=>value+1)};
}
