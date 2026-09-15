import {createContext,useContext,useEffect,useState} from 'react';
import axios from 'axios';
const StoreContext=createContext(null);
export const useStorefront=()=>useContext(StoreContext);
export default function StorefrontProvider({children}){
 const [store,setStore]=useState({name:'Dapur Kita',tagline:'From our home kitchen to your table.'});
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=()=>axios.get('/api/storefront/').then(r=>{if(active){setStore(r.data);setError('');}}).catch(()=>{if(active)setError('Kitchen details are temporarily unavailable. Please try again shortly.');});
  load();window.addEventListener('storefront-updated',load);
  return ()=>{active=false;window.removeEventListener('storefront-updated',load);};
 },[]);
 return <StoreContext.Provider value={{store,error}}>{children}</StoreContext.Provider>;
}
