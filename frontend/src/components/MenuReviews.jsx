import {useEffect,useState,useRef} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {useAuth} from '../contexts/AuthContext';
import {reviewPage} from '../utils/reviewResponse';
export default function MenuReviews({id}){
 const {isAuthenticated}=useAuth();
 return <ReviewsContent key={`${id}:${isAuthenticated}`} id={id}/>;
}
function ReviewsContent({id}){
 const [before,setBefore]=useState(null),[moreBusy,setMoreBusy]=useState(false),[moreError,setMoreError]=useState('');
 const moreController=useRef(null);
 const [reviews,setReviews]=useState([]),[access,setAccess]=useState(null),[rating,setRating]=useState(5),[comment,setComment]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();Promise.all([axios.get(`/api/products/${id}/reviews/`,{signal:controller.signal}),axios.get(`/api/products/${id}/review-access/`,{signal:controller.signal})]).then(([a,b])=>{const page=reviewPage(a.data,a.headers['x-next-review-before']);if(!controller.signal.aborted){setReviews(page.rows);setBefore(page.before);setAccess(b.data)}}).catch(e=>{if(!axios.isCancel(e))setMessage(apiError(e));}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>{controller.abort();moreController.current?.abort()};},[id,retry]);
 const more=async()=>{
  if(!before || moreBusy || busy)return;
  const controller=new AbortController();moreController.current=controller;
  setMoreBusy(true);setMoreError('');
  try{
   const r=await axios.get(`/api/products/${id}/reviews/`,{params:{before},signal:controller.signal});
   const page=reviewPage(r.data,r.headers['x-next-review-before']);
   if(!controller.signal.aborted){setReviews(previous=>[...previous,...page.rows.filter(row=>!previous.some(old=>old.id===row.id))]);setBefore(page.before)}
  }catch(e){if(!controller.signal.aborted)setMoreError(apiError(e,'Could not load more reviews.'));}
  finally{if(!controller.signal.aborted)setMoreBusy(false)}
 };
 const submit=async e=>{e.preventDefault();if(busy || moreBusy)return;setBusy(true);setMessage('');try{const r=await axios.post(`/api/products/${id}/reviews/`,{rating,comment},{headers:{'X-CSRFToken':getCookie('csrftoken')}});const page=reviewPage(r.data,r.headers['x-next-review-before']);setReviews(page.rows);setBefore(page.before);setComment('');setAccess({eligible:false,reason:'Thank you for sharing your experience.'});}catch(e){setMessage(apiError(e));}finally{setBusy(false)}};
 return <section className="dk-reviews"><h2>From our customers</h2>{loading?<p role="status">Loading reviews...</p>:<>{reviews.length===0 && access && <p>No reviews yet.</p>}{reviews.map(r=><article className="dk-panel" key={r.id}><strong>{r.rating}/5 · {r.customer}</strong><p>{r.comment}</p></article>)}{moreError && <p role="alert">{moreError}</p>}{before && <button type="button" disabled={moreBusy || busy} onClick={more}>{moreBusy?'Loading more reviews…':moreError?'Retry loading more reviews':'Load more reviews'}</button>}{access?.eligible?<form onSubmit={submit}><h3>Share your meal experience</h3><label>Rating<select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select></label><label>Your review<textarea required maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)}/></label><button disabled={busy || moreBusy}>{busy?'Posting...':'Post review'}</button></form>:<p>{access?.reason}</p>}</>}{message && <p role="alert">{message}</p>}{!loading && !access && <button onClick={()=>{setLoading(true);setMessage('');setAccess(null);setRetry(n=>n+1)}}>Retry loading reviews</button>}</section>;
}
