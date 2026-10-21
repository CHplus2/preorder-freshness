import {useEffect,useState,useRef,useId} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError,readApiError} from '../utils/apiError';
import {useAuth} from '../contexts/AuthContext';
import {useUI} from '../contexts/UIContext';
import {reviewPage,reviewAccess} from '../utils/reviewResponse';
import './MenuReviews.css';
export default function MenuReviews({id}){
 const {isAuthenticated}=useAuth();
 return <ReviewsContent key={`${id}:${isAuthenticated}`} id={id} authenticated={isAuthenticated}/>;
}
function ReviewsContent({id,authenticated}){
 const {setShowLogin}=useUI();
 const [before,setBefore]=useState(null),[moreBusy,setMoreBusy]=useState(false),[moreError,setMoreError]=useState('');
 const moreController=useRef(null),posting=useRef(false),errorRef=useRef(null),hint=useId();
 const [reviews,setReviews]=useState([]),[access,setAccess]=useState(null),[rating,setRating]=useState(5),[comment,setComment]=useState(''),[submitError,setSubmitError]=useState(''),[loadError,setLoadError]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  Promise.all([axios.get(`/api/products/${id}/reviews/`,{signal:controller.signal}),axios.get(`/api/products/${id}/review-access/`,{signal:controller.signal})])
   .then(([a,b])=>{const page=reviewPage(a.data,a.headers['x-next-review-before']),permission=reviewAccess(b.data);if(!controller.signal.aborted){setReviews(page.rows);setBefore(page.before);setAccess(permission);}})
   .catch(error=>{if(!axios.isCancel(error))setLoadError(readApiError(error));})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>{controller.abort();moreController.current?.abort();};
 },[id,retry]);
 useEffect(()=>{if(submitError && errorRef.current){errorRef.current.focus();errorRef.current.scrollIntoView({block:'nearest'});}},[submitError]);
 const refresh=()=>{setLoading(true);setLoadError('');setMoreError('');setSubmitError('');setAccess(null);setRetry(n=>n+1);};
 const more=async()=>{
  if(!before || moreBusy || busy)return;
  const controller=new AbortController();moreController.current=controller;setMoreBusy(true);setMoreError('');
  try{
   const response=await axios.get(`/api/products/${id}/reviews/`,{params:{before},signal:controller.signal});
   const page=reviewPage(response.data,response.headers['x-next-review-before']);
   if(!controller.signal.aborted){setReviews(previous=>[...previous,...page.rows.filter(row=>!previous.some(old=>old.id===row.id))]);setBefore(page.before);}
  }catch(error){if(!controller.signal.aborted)setMoreError(readApiError(error,'Could not load more reviews.'));}
  finally{if(!controller.signal.aborted)setMoreBusy(false);}
 };
 const submit=async event=>{
  event.preventDefault();if(posting.current || moreBusy)return;setSubmitError('');
  if(!comment.trim()){setSubmitError('Write a few words about your meal before posting.');return;}
  posting.current=true;setBusy(true);
  try{
   const response=await axios.post(`/api/products/${id}/reviews/`,{rating,comment},{headers:{'X-CSRFToken':getCookie('csrftoken')}});
   const page=reviewPage(response.data,response.headers['x-next-review-before']);
   setReviews(page.rows);setBefore(page.before);setComment('');setAccess({eligible:false,reason:'Thank you for sharing your meal experience.'});setSaved(true);
  }catch(error){setSubmitError(!error.response || error.response.status>=500 || error.code==='INVALID_RESPONSE'?'We could not confirm whether your review was posted. Your words are still here. Refresh reviews to check before posting again.':apiError(error));}
  finally{posting.current=false;setBusy(false);}
 };
 return <section className="dk-reviews customer-menu-reviews"><header className="reviews-heading"><div><h2>From our customers</h2><p>Reviews from customers with a delivered order of this menu.</p></div>{!loading && <button type="button" disabled={busy || moreBusy} onClick={refresh}>Refresh reviews</button>}</header>
 {loading?<p role="status">Loading reviews…</p>:loadError?<div className="review-notice" role="alert"><p>{loadError}</p><button type="button" onClick={refresh}>Try loading reviews again</button></div>:<>
  {saved && <p className="review-success" role="status">Your review is posted. Thank you for sharing your experience.</p>}
  {reviews.length===0 && <p>No reviews yet. Be the first to share your experience after delivery.</p>}
  <div className="customer-review-list">{reviews.map(review=><article key={review.id}><header><strong>{review.customer}</strong><span>{review.rating} / 5</span></header><p>{review.comment}</p></article>)}</div>
  {moreError && <p role="alert" className="review-notice">{moreError}</p>}{before && <button type="button" disabled={moreBusy || busy} onClick={more}>{moreBusy?'Loading more reviews…':moreError?'Retry loading more reviews':'Load more reviews'}</button>}
  {access?.eligible?<form onSubmit={submit} className="customer-review-form"><h3>How was your meal?</h3><p>Your review is public. Please leave out phone numbers, addresses and other personal details.</p>{submitError && <div className="review-notice" role="alert" ref={errorRef} tabIndex={-1}>{submitError}</div>}
   <fieldset disabled={busy || moreBusy}><label>Rating<select value={rating} onChange={event=>setRating(Number(event.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} {n===1?'star':'stars'}</option>)}</select></label><label>Your review<textarea required maxLength={1000} value={comment} onChange={event=>{setComment(event.target.value);setSubmitError('');}} aria-describedby={hint}/></label><p id={hint}>{comment.length} / 1,000 characters</p></fieldset>
   <button className="review-submit" disabled={busy || moreBusy}>{busy?'Posting review…':'Post review'}</button>
  </form>:<div className="review-access"><p>{access?.reason}</p>{authenticated===false && <button type="button" onClick={()=>setShowLogin(true)}>Sign in to review</button>}</div>}
 </>}
 </section>;
}
