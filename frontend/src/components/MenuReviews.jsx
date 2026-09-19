import {useEffect,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {useAuth} from '../contexts/AuthProvider';
export default function MenuReviews({id}){
 const {isAuthenticated}=useAuth();
 const [reviews,setReviews]=useState([]),[access,setAccess]=useState(null),[rating,setRating]=useState(5),[comment,setComment]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setMessage('');setAccess(null);Promise.all([axios.get(`/api/products/${id}/reviews/`,{signal:controller.signal}),axios.get(`/api/products/${id}/review-access/`,{signal:controller.signal})]).then(([a,b])=>{setReviews(a.data);setAccess(b.data)}).catch(e=>{if(!axios.isCancel(e))setMessage(apiError(e));}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort();},[id,isAuthenticated,retry]);
 const submit=async e=>{e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{const r=await axios.post(`/api/products/${id}/reviews/`,{rating,comment},{headers:{'X-CSRFToken':getCookie('csrftoken')}});setReviews(r.data);setComment('');setAccess({eligible:false,reason:'Thank you for sharing your experience.'});}catch(e){setMessage(apiError(e));}finally{setBusy(false)}};
 return <section className="dk-reviews"><h2>From our customers</h2>{loading?<p role="status">Loading reviews...</p>:<>{reviews.length===0 && access && <p>No reviews yet.</p>}{reviews.map(r=><article className="dk-panel" key={r.id}><strong>{r.rating}/5 · {r.customer}</strong><p>{r.comment}</p></article>)}{access?.eligible?<form onSubmit={submit}><h3>Share your meal experience</h3><label>Rating<select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select></label><label>Your review<textarea required maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)}/></label><button disabled={busy}>{busy?'Posting...':'Post review'}</button></form>:<p>{access?.reason}</p>}</>}{message && <p role="alert">{message}</p>}{!loading && !access && <button onClick={()=>setRetry(n=>n+1)}>Retry loading reviews</button>}</section>;
}
