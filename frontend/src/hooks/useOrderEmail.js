import {useEffect,useState} from 'react';
import axios from 'axios';
import {orderEmailContact} from '../utils/orderEmail';
import {useAuth} from '../contexts/AuthContext';

export default function useOrderEmail(){
 const auth=useAuth(),scope=auth?.accountKey;
 const [snapshot,setSnapshot]=useState(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get('/api/account/order-email/',{signal:controller.signal,timeout:10000})
   .then(({data})=>{if(!controller.signal.aborted)setSnapshot({scope,attempt,status:'ready',...orderEmailContact(data)});})
   .catch(()=>{if(!controller.signal.aborted)setSnapshot({scope,attempt,status:'error',email:'',available:false});});
  return()=>controller.abort();
 },[scope,attempt]);
 const current=snapshot?.scope===scope && snapshot?.attempt===attempt?snapshot:{email:'',available:false,status:'loading'};
 return {...current,retry:()=>setAttempt(n=>n+1)};
}
