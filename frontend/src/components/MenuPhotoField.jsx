import MenuPhoto from './MenuPhoto';
import { useId, useState, useRef, useEffect } from "react";
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import "./MenuPhotoField.css";
const noop=()=>{};

export default function MenuPhotoField({ value, onChange, onBusy=noop, fieldError='' }) {
  const id = useId();
  const [failedUrl, setFailedUrl] = useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const controller=useRef(null);
  useEffect(()=>()=>{controller.current?.abort();onBusy(false);},[onBusy]);
  const upload=async file=>{
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>4*1024*1024){setError('Choose a JPEG, PNG or WebP photo up to 4 MB.');return;}
    controller.current?.abort();const current=new AbortController();controller.current=current;
    setBusy(true);onBusy(true);setError('');
    const data=new FormData();data.append('image',file);
    try{const response=await axios.post('/api/admin/menu-photos/',data,{signal:current.signal,headers:{'X-CSRFToken':getCookie('csrftoken')}});
      if(typeof response.data.image_url!=='string' || !/^\/api\/menu-photos\/[0-9a-f]{64}\/$/.test(response.data.image_url))throw new Error('Invalid upload response');
      if(!current.signal.aborted){setFailedUrl(null);onChange(response.data.image_url);}
    }catch(e){if(!current.signal.aborted)setError(apiError(e,'Photo upload could not be confirmed. Try again.'));}
    finally{if(!current.signal.aborted){setBusy(false);onBusy(false);}}
  };
  const url = value.trim();
  const supported = /^https?:\/\//i.test(url) || /^\/api\/menu-photos\/[0-9a-f]{64}\/$/.test(url);
  const failed = url && (!supported || failedUrl === url);

  return (
    <section className="menu-photo-field" aria-labelledby={id + "-label"}>
      <h3 id={id + "-label"}>Menu photo</h3>
      <label htmlFor={id+'-file'}>Upload from your device</label>
      <input id={id+'-file'} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-describedby={id+'-upload-help'} onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/>
      <p id={id+'-upload-help'} className="menu-photo-help">JPEG, PNG or WebP, up to 4 MB. Photos are resized and saved securely. Save the menu to use the uploaded photo.</p>
      {busy && <p role="status">Uploading photo…</p>}{error && <p role="alert">{error}</p>}
      <label htmlFor={id}>Or paste an image URL</label>
      <input id={id} type="url" inputMode="url" value={value.startsWith('/api/menu-photos/')?'':value}
        data-menu-field="image_url" aria-invalid={Boolean(fieldError)}
        disabled={busy}
        placeholder="https://example.com/your-food-photo.jpg"
        aria-describedby={id + "-help"+(fieldError?' '+id+'-validation':'')}
        onChange={event => { setFailedUrl(null); onChange(event.target.value); }} />
      {fieldError && <p id={id+'-validation'} className="menu-field-error">{fieldError}</p>}
      {value.startsWith('/api/menu-photos/') && <p className="menu-photo-help">Uploaded photo selected. Pasting a URL replaces it.</p>}
      <p id={id + "-help"} className="menu-photo-help">
        Paste a public image link, not a webpage link. Use a photo you own or have permission to use.
      </p>
      <figure className="menu-photo-preview">
        <div className="menu-photo-frame">
          {url && !failed ? (
            <MenuPhoto sizes="(max-width: 600px) 85vw, 400px" key={url} src={url} alt="Menu photo preview"
              onError={() => setFailedUrl(url)} />
          ) : (
            <p role={failed ? "status" : undefined}>
              {failed ? "This photo could not be loaded. Check that the link opens an image without signing in." : "Your photo preview will appear here."}
            </p>
          )}
        </div>
        <figcaption>Photo preview - the full image is shown here; menu cards may crop its edges.</figcaption>
      </figure>
    </section>
  );
}
