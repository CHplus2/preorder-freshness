import { useEffect, useRef, useState } from 'react';
import { useUI } from '../contexts/UIContext';

// Keep newly raised errors inside the native modal's accessible surface.
export default function DialogFeedback() {
  const { alert, setAlert } = useUI();
  const [initial] = useState(alert);
  const ref = useRef(null);
  useEffect(()=>{
    if(ref.current){ref.current.scrollIntoView({block:'nearest'});ref.current.focus({preventScroll:true});}
  },[alert]);
  return alert !== initial && alert.type === 'error'
    ? <div ref={ref} tabIndex={-1} role="alert" className="account-error dialog-feedback"><p>{alert.message}</p><button type="button" aria-label="Dismiss form error" onClick={()=>setAlert({message:'',type:''})}>Dismiss</button></div> : null;
}
