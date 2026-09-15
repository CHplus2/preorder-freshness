import {useEffect,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
export default function MenuReviews({id}){
 const [reviews,setReviews]=useState([]),[rating,setRating]=useState(5),[comment,setComment]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{axios.get(`/api/products/${id}/reviews/`).then(r=>setReviews(r.data)).catch(()=>setMessage('Reviews could not be loaded.'));},[id]);
 const submit=async e=>{e.preventDefault();setBusy(true);try{const r=await axios.post(`/api/products/${id}/reviews/`,{rating,comment},{headers:{'X-CSRFToken':getCookie('csrftoken')}});setReviews(r.data);setComment('');setMessage('Thank you for your review.');}catch(e){setMessage(JSON.stringify(e.response?.data || 'Review could not be saved.'));}finally{setBusy(false)}};
 return <section className="dk-reviews"><h2>From our customers</h2>{reviews.length===0 && <p>No reviews yet.</p>}{reviews.map(r=><article className="dk-panel" key={r.id}><strong>{r.rating}/5 · {r.customer}</strong><p>{r.comment}</p></article>)}<form onSubmit={submit}><h3>Share your meal experience</h3><p>Available after delivery. One review per menu.</p><label>Rating<select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select></label><label>Your review<textarea required maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)}/></label><button disabled={busy}>Post review</button><p role="status">{message}</p></form></section>;
}
