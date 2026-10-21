import {useEffect,useState} from 'react';
import {X,CheckCircle,Info,TriangleAlert} from 'lucide-react';
import {motion,useReducedMotion} from 'framer-motion';
import './AppNotification.css';

export default function AppNotification({alert,onDismiss}) {
  const [paused,setPaused]=useState(false);
  const reduced=useReducedMotion();
  useEffect(()=>{
    if(alert.type==='error' || paused)return;
    const timer=setTimeout(onDismiss,8000);
    return()=>clearTimeout(timer);
  },[alert,onDismiss,paused]);
  const Icon=alert.type==='error'?TriangleAlert:alert.type==='success'?CheckCircle:Info;
  return <motion.div className={`app-notification ${alert.type}`} role={alert.type==='error'?'alert':'status'} initial={reduced?false:{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={reduced?{opacity:1}:{opacity:0,y:-12}} transition={{duration:reduced?0:.2}}
    onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}>
    <Icon size={21} aria-hidden="true"/><p>{alert.message}</p><button type="button" aria-label="Dismiss notification" onClick={onDismiss}><X size={19} aria-hidden="true"/></button>
  </motion.div>;
}
