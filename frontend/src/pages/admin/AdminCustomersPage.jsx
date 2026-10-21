import {useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../../utils/cookieUtils';
import {apiError,readApiError} from '../../utils/apiError';
import {customerAccounts} from '../../utils/customerAccounts';

export default function AdminCustomersPage(){
 const [customers,setCustomers]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const pending=useRef(false);
 useEffect(()=>{
  const controller=new AbortController();
  axios.get('/api/admin/customers/',{signal:controller.signal,timeout:30000})
   .then(({data})=>{const rows=customerAccounts(data);if(!controller.signal.aborted)setCustomers(rows);})
   .catch(error=>{if(!controller.signal.aborted)setError(readApiError(error));})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[retry]);
 const toggle=async customer=>{
  if(pending.current || loading || error)return;
  pending.current=true;setBusy(customer.id);
  try{
   const {data}=await axios.patch(`/api/admin/customers/${customer.id}/`,{is_active:!customer.is_active},{timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   const [saved]=customerAccounts([data]);if(saved.id!==customer.id)throw Object.assign(new Error('Unexpected customer'),{code:'INVALID_RESPONSE'});
   setCustomers(rows=>rows.map(row=>row.id===saved.id?saved:row));
  }catch(error){setError(!error.response || error.response.status>=500 || error.code==='INVALID_RESPONSE'?'The account update could not be confirmed. Refresh customers to check access before trying again.':apiError(error));}
  finally{pending.current=false;setBusy(null);}
 };
 return <main className="dk-workspace"><div className="admin-page-heading"><div><span className="dk-eyebrow">KITCHEN ACCOUNTS</span><h1>Customers</h1><p>Manage customer accounts and store access.</p></div><button disabled={loading || busy!==null} onClick={()=>{setLoading(true);setError('');setRetry(n=>n+1)}}>{loading?'Refreshing…':error?'Retry loading customers':'Refresh customers'}</button></div>
  {error && <p className="inventory-error" role="alert">{error}</p>}
  {loading?<p role="status">Loading customers…</p>:error?null:customers.length===0?<section className="admin-empty"><h2>No customer accounts yet</h2><p>Accounts appear here when customers register with your kitchen.</p></section>:<><p>{customers.length} {customers.length===1?'account':'accounts'} · Kitchen staff access is managed separately.</p><div className="admin-table-scroll"><table><caption className="sr-only">Customer account access</caption><thead><tr><th scope="col">Username</th><th scope="col">Access</th><th scope="col">Role</th><th scope="col">Action</th></tr></thead><tbody>{customers.map(customer=><tr key={customer.id}><th scope="row">{customer.username}</th><td>{customer.is_active?'Active':'Inactive'}</td><td>{customer.is_staff?'Kitchen staff':'Customer'}</td><td>{customer.is_staff?'Staff account':<button disabled={busy!==null} aria-label={`${customer.is_active?'Deactivate':'Activate'} ${customer.username}`} onClick={()=>toggle(customer)}>{busy===customer.id?'Saving…':customer.is_active?'Deactivate':'Activate'}</button>}</td></tr>)}</tbody></table></div></>}
 </main>;
}
