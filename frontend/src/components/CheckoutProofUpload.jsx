import {useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {useAuth} from '../contexts/AuthContext';
export default function CheckoutProofUpload({amount,disabled,selection,qrUrl,instructions,onUploaded}){
 const [file,setFile]=useState(null),[proof,setProof]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [failedQrUrl,setFailedQrUrl]=useState('');
 const controller=useRef(null),lock=useRef(false),{isSessionCurrent}=useAuth();
 useEffect(()=>()=>controller.current?.abort(),[]);
 const upload=async()=>{
  if(disabled||!file||lock.current)return;
  if(file.size>4*1024*1024){setError('Choose a receipt image up to 4 MB.');return;}
  lock.current=true;setBusy(true);setError('');controller.current=new AbortController();
  try{
   const body=new FormData();body.append('image',file);Object.entries(selection).forEach(([key,value])=>body.append(key,String(value)));
   const {data}=await axios.post('/api/checkout-proofs/',body,{signal:controller.current.signal,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(!isSessionCurrent())return;
   if(!/^[a-f0-9-]{36}$/.test(data?.id||'') || data.url!==`/api/checkout-proofs/${data.id}/`||Number(data.amount)!==amount)throw new Error('The checkout total changed. Refresh the basket before submitting proof again.');
   setProof(data);onUploaded(data);
  }catch(e){if(!axios.isCancel(e)&&isSessionCurrent())setError(apiError(e));}finally{lock.current=false;setBusy(false)}
 };
 return <div className="checkout-proof">
  <p><strong>Pay RM {amount.toFixed(2)}</strong> using the kitchen’s QR code. Confirm the recipient and amount in your banking app.</p>
  <p className="checkout-hint">Already paid? Do not pay twice. Keep your receipt and contact the kitchen if the order amount changes or checkout cannot complete.</p>
  {failedQrUrl===qrUrl?<p role="alert" className="checkout-error">The receiving QR image could not load. Open the code using the link below, or contact the kitchen before paying.</p>:<img className="checkout-qr-image" src={qrUrl} alt="Kitchen DuitNow QR code" referrerPolicy="no-referrer" onError={()=>setFailedQrUrl(qrUrl)}/>}<a href={qrUrl} target="_blank" rel="noopener noreferrer">Open DuitNow QR code</a>{instructions&&<p className="checkout-payment-instructions">{instructions}</p>}
  <label>Payment receipt image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||busy} onChange={e=>{setFile(e.target.files?.[0]||null);setProof(null);onUploaded(null);setError('')}}/></label>
  <p className="checkout-hint">JPG, PNG or WebP, up to 4 MB. Visible only to you and kitchen staff.</p>
  <button type="button" disabled={disabled||busy||!file} onClick={upload}>{busy?'Uploading receipt…':proof?'Replace receipt':'Upload receipt'}</button>
  {proof&&<div className="checkout-proof-saved" role="status"><strong>Receipt uploaded</strong><p>The kitchen will verify this payment. Do not pay again.</p><a href={proof.url} target="_blank" rel="noopener noreferrer">View uploaded receipt</a></div>}
  {error&&<p role="alert" className="checkout-error">{error}</p>}
 </div>;
}
