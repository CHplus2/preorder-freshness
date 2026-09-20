import {useEffect,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../../utils/cookieUtils';
import {apiError} from '../../utils/apiError';

export default function AdminCustomersPage(){
 const [customers,setCustomers]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');axios.get('/api/admin/customers/',{signal:c.signal}).then(r=>setCustomers(r.data)).catch(e=>{if(!axios.isCancel(e))setError(apiError(e))}).finally(()=>{if(!c.signal.aborted)setLoading(false)});return()=>c.abort();},[retry]);
 const toggle=async customer=>{if(busy)return;setBusy(customer.id);setError('');try{const r=await axios.patch(`/api/admin/customers/${customer.id}/`,{is_active:!customer.is_active},{headers:{'X-CSRFToken':getCookie('csrftoken')}});setCustomers(rows=>rows.map(c=>c.id===r.data.id?r.data:c));}catch(e){setError(apiError(e))}finally{setBusy(null)}};
 return <main className="dk-workspace"><div className="admin-page-heading"><div><h1>Customers</h1><p>Manage customer accounts and store access.</p></div><button disabled={loading} onClick={()=>setRetry(n=>n+1)}>{loading?'Refreshing...':'Refresh customers'}</button></div>{error && <p role="alert">{error}</p>}{loading?<p role="status">Loading customers...</p>:<div className="admin-table-scroll"><table><thead><tr><th>Username</th><th>Active</th><th>Role</th><th>Action</th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td>{c.username}</td><td>{c.is_active?'Yes':'No'}</td><td>{c.is_staff?'Owner':'Customer'}</td><td>{c.is_staff?'Owner account':<button disabled={busy!==null} onClick={()=>toggle(c)}>{busy===c.id?'Saving...':c.is_active?'Deactivate':'Activate'}</button>}</td></tr>)}</tbody></table></div>}</main>;
}
