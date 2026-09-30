import {useState} from 'react';
import axios from 'axios';
import {getCookie} from '../../utils/cookieUtils';
import {apiError} from '../../utils/apiError';
export default function RecoveryPage(){
  const [credentials]=useState(()=>{const p=new URLSearchParams(window.location.hash.slice(1));const value={uid:p.get('uid'),token:p.get('token')};window.history.replaceState(null,'',window.location.pathname);return value});
  const [form,setForm]=useState({username:'',email:'',password:'',confirm:''}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false);
  const reset=!!credentials.token;
  const submit=async e=>{e.preventDefault();if(busy)return;setError('');setMessage('');if(reset && form.password!==form.confirm){setError('Passwords do not match.');return}setBusy(true);
    try{const r=await axios.post(reset?'/api/auth/recovery/confirm/':'/api/auth/recovery/',reset?{...credentials,password:form.password}:{username:form.username,email:form.email},{headers:{'X-CSRFToken':getCookie('csrftoken')}});setMessage(r.data.detail);if(reset)setDone(true)}catch(e){setError(apiError(e))}finally{setBusy(false)}
  };
  return <main className="dk-workspace"><h1>{reset?'Choose a new password':'Recover your account'}</h1><p>Use the recovery email saved when you registered. Older accounts without an email need help from the kitchen owner.</p>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {!done && <form className="fyp-form" onSubmit={submit}>{(reset?[['password','New password','password'],['confirm','Confirm password','password']]:[['username','Username','text'],['email','Recovery email','email']]).map(([key,label,type])=><label key={key}>{label}<input required type={type} maxLength={type==='password'?128:254} autoComplete={type==='password'?'new-password':key} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<button disabled={busy}>{busy?'Please wait…':reset?'Update password':'Request reset link'}</button></form>}
  </main>;
}
