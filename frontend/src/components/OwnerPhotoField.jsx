import {useEffect,useId,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import './OwnerPhotoField.css';

const noop=()=>{};
const managed=url=>/^\/api\/menu-photos\/[0-9a-f]{64}\/$/.test(url);

export default function OwnerPhotoField({value='',onChange,onBusy=noop,disabled=false}){
 const id=useId(),request=useRef(null),pending=useRef(false);
 const [uploading,setUploading]=useState(false),[error,setError]=useState(''),[failedUrl,setFailedUrl]=useState('');
 useEffect(()=>()=>{request.current?.abort();onBusy(false)},[onBusy]);
 const upload=async file=>{
  if(!file||disabled||pending.current)return;
  setError('');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<=0||file.size>4*1024*1024){setError('Choose a JPEG, PNG or WebP photo up to 4 MB.');return;}
  pending.current=true;const current=new AbortController();request.current=current;
  setUploading(true);onBusy(true);
  try{
   const body=new FormData();body.append('image',file);
   const {data}=await axios.post('/api/admin/menu-photos/',body,{signal:current.signal,timeout:20000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(!managed(data?.image_url||''))throw new Error('The uploaded photo could not be verified.');
   if(!current.signal.aborted){setFailedUrl('');onChange(data.image_url);}
  }catch(error){if(!current.signal.aborted)setError(apiError(error,'Could not upload this photo. Your previous photo is kept.'));}
  finally{pending.current=false;if(!current.signal.aborted){setUploading(false);onBusy(false)}}
 };
 const url=value.trim(),locked=disabled||uploading;
 const visible=url && (managed(url)||/^https?:\/\//i.test(url)) && failedUrl!==url;
 return <section className="owner-photo-field" aria-labelledby={id+'-title'}>
  <h3 id={id+'-title'}>Owner photo</h3>
  <div className="owner-photo-layout">
   <div className="owner-photo-preview">{visible?<img key={url} src={url} alt="Owner photo preview" onError={()=>setFailedUrl(url)}/>:<span>{url?'Photo preview unavailable':'No photo selected'}</span>}</div>
   <div className="owner-photo-controls">
    <label htmlFor={id+'-file'}>Upload photo</label>
    <input id={id+'-file'} type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} aria-describedby={id+'-help'} onChange={event=>{void upload(event.target.files?.[0]);event.target.value=''}}/>
    <p id={id+'-help'}>JPEG, PNG or WebP, up to 4 MB. Save business story to show the photo on Our story.</p>
    {uploading&&<p role="status">Uploading photo…</p>}
    {error&&<p role="alert" className="owner-photo-error">{error}</p>}
    {url&&<button type="button" disabled={locked} onClick={()=>{setError('');setFailedUrl('');onChange('')}}>Remove photo</button>}
    <details className="owner-photo-link"><summary>Use an image link instead</summary>
     <label htmlFor={id+'-url'}>Owner photo URL</label>
     <input id={id+'-url'} type="url" maxLength={200} disabled={locked} value={managed(url)?'':value} placeholder="https://example.com/owner.jpg" onChange={event=>{setError('');setFailedUrl('');onChange(event.target.value)}}/>
     {managed(url)&&<p>An uploaded photo is selected. A link will replace it.</p>}
    </details>
   </div>
  </div>
 </section>;
}
