import {StoreContext} from './StorefrontContext';
import {useEffect,useState} from 'react';
import axios from 'axios';
import {pricingConfigured} from '../utils/checkoutPresentation';
import {invalidResponse} from '../utils/apiResponse';
export default function StorefrontProvider({children}){
 const [store,setStore]=useState({name:'Dapur Kita',tagline:'From our home kitchen to your table.'});
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true,controller;
  const load=()=>{
   controller?.abort();const current=new AbortController();controller=current;
   return axios.get('/api/storefront/',{signal:current.signal,timeout:30000}).then(({data})=>{
    if(!pricingConfigured(data) || typeof data.name!=='string' || !data.name.trim())throw invalidResponse();
    if(active && !current.signal.aborted){setStore(data);setError('');}
   }).catch(()=>{if(active && !current.signal.aborted)setError('Kitchen details are temporarily unavailable. Please try again shortly.');});
  };
  load();window.addEventListener('storefront-updated',load);
  return ()=>{active=false;controller?.abort();window.removeEventListener('storefront-updated',load);};
 },[]);
 return <StoreContext.Provider value={{store,error}}>{children}</StoreContext.Provider>;
}
