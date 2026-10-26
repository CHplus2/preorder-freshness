import {useEffect,useState} from 'react';
import axios from 'axios';
import {orderEmailContact} from '../utils/orderEmail';
import {useAuth} from '../contexts/AuthContext';

export default function useOrderEmail(){
 const auth=useAuth();
 const scope=auth?.accountKey;
 const [snapshot,setSnapshot]=useState(null);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get('/api/account/order-email/',{signal:controller.signal,timeout:10000})
   .then(({data})=>{if(!controller.signal.aborted)setSnapshot({scope,...orderEmailContact(data)});})
   .catch(()=>{/* Email reminders are optional; checkout remains available. */});
  return()=>controller.abort();
 },[scope]);
 return snapshot?.scope===scope?snapshot:null;
}
