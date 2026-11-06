import {useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {useAuth} from '../contexts/AuthContext';
export default function CheckoutProofUpload({amount,disabled,selection,qrUrl,instructions,onUploaded,confirmed=true}){
 const [attempt,setAttempt]=useState(null),[finished,setFinished]=useState(0),[proof,setProof]=useState(null),[error,setError]=useState('');
 const [failedQrUrl,setFailedQrUrl]=useState('');
 const controller=useRef(null),sequence=useRef(0),started=useRef(0),{isSessionCurrent}=useAuth();
 const busy=!!attempt&&finished!==attempt.id;
 useEffect(()=>()=>controller.current?.abort(),[]);
 // A file chooser can trigger a focus/availability recheck. Keep the chosen
 // file queued until that check finishes, without restarting an active upload.
 useEffect(()=>{
  if(!attempt||disabled||started.current===attempt.id)return;
  started.current=attempt.id;
  const current=new AbortController();controller.current=current;
  const upload=async()=>{
   try{
    const body=new FormData();body.append('image',attempt.file);Object.entries(selection).forEach(([key,value])=>body.append(key,String(value)));
    const {data}=await axios.post('/api/checkout-proofs/',body,{signal:current.signal,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
    if(current.signal.aborted||sequence.current!==attempt.id||!isSessionCurrent())return;
    if(!/^[a-f0-9-]{36}$/.test(data?.id||'') || data.url!==`/api/checkout-proofs/${data.id}/`||Number(data.amount)!==amount){
     setError('The checkout total changed. Review the total before uploading your existing receipt again. Do not pay twice.');return;
    }
    setProof(data);onUploaded(data);
   }catch(e){if(!current.signal.aborted&&sequence.current===attempt.id&&isSessionCurrent())setError(apiError(e));}
   finally{if(!current.signal.aborted&&sequence.current===attempt.id&&isSessionCurrent())setFinished(attempt.id)}
  };
  upload();
 },[attempt,disabled,selection,amount,isSessionCurrent,onUploaded]);
 const choose=file=>{
  if(!file)return;
  controller.current?.abort();const id=++sequence.current;
  setProof(null);onUploaded(null);setError('');setAttempt(null);
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Choose a JPG, PNG or WebP receipt image.');return;}
  if(file.size>4*1024*1024){setError('Choose a receipt image up to 4 MB.');return;}
  setAttempt({id,file});
 };
 return <div className="checkout-proof" aria-busy={busy}>
  {!proof&&confirmed?<p><strong>Payment amount: RM {amount.toFixed(2)}</strong> {qrUrl?(instructions?'Use the kitchen’s QR code or bank details below.':'Use the kitchen’s QR code below.'):'Use the kitchen’s bank details below.'} Use a banking app that supports this payment and check the recipient and amount before confirming.</p>:!proof&&<p role="status">Rechecking payment details. Wait for the confirmed total before paying.</p>}
  <p className="checkout-hint">Already paid? Do not pay twice. Keep your receipt and contact the kitchen if the order amount changes or checkout cannot complete.</p>
  {confirmed&&qrUrl&&<>{failedQrUrl===qrUrl?<p role="alert" className="checkout-error">The receiving QR image could not load. Open the code using the link below, or contact the kitchen before paying.</p>:<img className="checkout-qr-image" src={qrUrl} alt="Kitchen receiving QR code" referrerPolicy="no-referrer" onError={()=>setFailedQrUrl(qrUrl)}/>}<a href={qrUrl} target="_blank" rel="noopener noreferrer">Open payment QR code</a></>}{confirmed&&instructions&&<p className="checkout-payment-instructions">{instructions}</p>}
  <label>Payment receipt image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||busy} onChange={e=>choose(e.target.files?.[0]||null)}/></label>
  <p className="checkout-hint">Uploads automatically when selected. JPG, PNG or WebP, up to 4 MB. Visible only to you and kitchen staff.</p>
  {busy&&<p role="status">{disabled?'Receipt selected. Waiting for the availability check…':'Uploading receipt…'}</p>}
  {proof&&<div className="checkout-proof-saved" role="status"><strong>Receipt uploaded</strong><p>Ready to attach to your RM {amount.toFixed(2)} preorder. The kitchen will verify the transfer after you place it. Do not pay again.</p><a href={proof.url} target="_blank" rel="noopener noreferrer">View uploaded receipt</a></div>}
  {error&&<div role="alert" className="checkout-error"><p>{error}</p>{attempt&&<button type="button" disabled={disabled||busy} onClick={()=>choose(attempt.file)}>Retry receipt upload</button>}</div>}
 </div>;
}
