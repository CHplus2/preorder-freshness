import {useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import './ReceivingQrUpload.css';
import {qrCrop} from '../utils/qrCrop';
export default function ReceivingQrUpload({value='',onChange,disabled=false}){
 const [file,setFile]=useState(null),[source,setSource]=useState(''),[shape,setShape]=useState(null),[mode,setMode]=useState('maybank'),[crop,setCrop]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const canvas=useRef(null),image=useRef(null),controller=useRef(null);
 const blob=useRef('');
 useEffect(()=>()=>{if(blob.current)URL.revokeObjectURL(blob.current)},[]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{
  if(!crop||!canvas.current||!image.current)return;
  const node=canvas.current;node.width=crop.size;node.height=crop.size;
  const context=node.getContext('2d');context.clearRect(0,0,crop.size,crop.size);context.imageSmoothingEnabled=false;
  context.drawImage(image.current,crop.x,crop.y,crop.size,crop.size,0,0,crop.size,crop.size);
 },[crop]);
 const chooseMode=next=>{setMode(next);if(shape)setCrop(qrCrop(shape.width,shape.height,next));setNotice('')};
 const upload=async()=>{
  if(!file||!crop||busy)return;setError('');setNotice('');
  if(file.size>4*1024*1024){setError('Choose an image up to 4 MB.');return;}
  setBusy(true);controller.current=new AbortController();
  try{
   const body=new FormData();body.append('image',file);Object.entries(crop).forEach(([key,n])=>body.append(key,String(n)));
   const {data}=await axios.post('/api/receiving-qr/',body,{signal:controller.current.signal,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(!/^\/api\/menu-photos\/[a-f0-9]{64}\/$/.test(data?.image_url||''))throw new Error('QR upload response could not be verified.');
   onChange(data.image_url);setNotice('QR crop uploaded. Save Settings to use it at checkout.');
  }catch(e){if(!axios.isCancel(e))setError(apiError(e));}finally{setBusy(false)}
 };
 return <div className="receiving-qr-upload">
  <label>Upload receiving QR image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled||busy} onChange={e=>{const next=e.target.files?.[0]||null;if(blob.current)URL.revokeObjectURL(blob.current);blob.current=next?URL.createObjectURL(next):'';setSource(blob.current);setFile(next);setShape(null);setCrop(null);setNotice('');setError('')}}/></label>
  <p>JPG, PNG or WebP, up to 4 MB. Select the QR square with its white border. Only the crop is saved for public display.</p>
  {source&&<><label>Image layout<select value={mode} disabled={disabled||busy} onChange={e=>chooseMode(e.target.value)}><option value="maybank">Maybank receiving card · QR only</option><option value="square">Image already contains QR only</option></select></label>
   <img className="receiving-qr-source" ref={image} src={source} alt="Original QR card for local cropping" onLoad={e=>{const dims={width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight};setShape(dims);setCrop(qrCrop(dims.width,dims.height,mode))}} onError={()=>setError('This image could not be opened. Choose a JPG, PNG or WebP image.')}/>
   {crop&&<><strong>Public QR preview</strong><canvas ref={canvas} aria-label="QR-only preview"/><details><summary>Adjust crop if needed</summary><div className="receiving-qr-crop">{[['x','Left edge'],['y','Top edge'],['size','Square size']].map(([key,label])=><label key={key}>{label} (pixels)<input disabled={disabled||busy} type="number" min={key==='size'?128:0} max={key==='size'?2000:12000} value={crop[key]} onChange={e=>setCrop({...crop,[key]:Math.min(key==='size'?2000:12000,Math.max(key==='size'?128:0,Number(e.target.value)))})}/></label>)}</div></details>
   <p>Check that the whole QR and its white border fit. The preset suits the Maybank card layout shown; adjust it for other layouts. Scan the saved QR in your bank app to check the receiving details before accepting payments.</p>
   <button type="button" disabled={disabled||busy||crop.size<128} onClick={upload}>{busy?'Uploading…':'Use this QR crop'}</button></>}
  </>}
  <details><summary>Or use an image URL</summary><label>Receiving QR image URL<input type="text" inputMode="url" maxLength="200" disabled={disabled||busy} value={value} onChange={e=>onChange(e.target.value)} placeholder="https://… or an uploaded QR path"/></label></details>
  {!source&&value&&<img className="receiving-qr-current" src={value} alt="Current receiving QR"/>}
  <p>Cropping removes printed text outside the square. Your bank may still show your receiving name after scanning. An external URL displays the image as supplied.</p>
  {error&&<p role="alert" className="settings-field-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </div>;
}
