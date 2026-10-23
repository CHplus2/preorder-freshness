import {useEffect,useState} from 'react';
import axios from 'axios';
export default function useEscrowConfig(){
 const [config,setConfig]=useState(null);
 useEffect(()=>{const c=new AbortController();axios.get('/api/payments/escrow/config/',{signal:c.signal,timeout:10000}).then(({data})=>{if(typeof data?.enabled==='boolean' && data.chain_id===11155111)setConfig(data)}).catch(()=>{});return()=>c.abort()},[]);
 return config;
}
