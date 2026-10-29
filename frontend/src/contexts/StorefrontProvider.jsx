import {StoreContext} from './StorefrontContext';
import {useEffect,useState} from 'react';
import axios from 'axios';
import {pricingConfigured} from '../utils/checkoutPresentation';
import {invalidResponse} from '../utils/apiResponse';
export default function StorefrontProvider({children}){
 const [store,setStore]=useState({name:'Dapur Kita',tagline:'From our home kitchen to your table.'});
 const [error,setError]=useState('');
 const [refreshing,setRefreshing]=useState(false);
 useEffect(()=>{
  let active=true,controller,returnTimer;
  const load=()=>{
   controller?.abort();const current=new AbortController();controller=current;
   setRefreshing(true);
   return axios.get('/api/storefront/',{signal:current.signal,timeout:30000}).then(({data})=>{
    if(!pricingConfigured(data) || typeof data.name!=='string' || !data.name.trim())throw invalidResponse();
    if(active && !current.signal.aborted){setStore(data);setError('');}
   }).catch(()=>{if(active && !current.signal.aborted)setError('Kitchen details are temporarily unavailable. Please try again shortly.');})
    .finally(()=>{if(active && !current.signal.aborted)setRefreshing(false);});
  };
  const onReturn=()=>{
   if(document.visibilityState==='hidden')return;
   clearTimeout(returnTimer);returnTimer=setTimeout(load,100);
  };
  load();window.addEventListener('storefront-updated',load);
  window.addEventListener('focus',onReturn);document.addEventListener('visibilitychange',onReturn);
  return ()=>{active=false;clearTimeout(returnTimer);controller?.abort();window.removeEventListener('storefront-updated',load);window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn);};
 },[]);
 return <StoreContext.Provider value={{store,error,refreshing}}>{children}</StoreContext.Provider>;
}
