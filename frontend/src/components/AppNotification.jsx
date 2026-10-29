import {useEffect,useRef,useState} from 'react';
import {X,CheckCircle,Info,TriangleAlert} from 'lucide-react';
import {motion,useReducedMotion} from 'framer-motion';
import './AppNotification.css';

export default function AppNotification({alert,onDismiss}) {
  const [visible,setVisible]=useState(true);
  const [hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  const duration=alert.type==='error'?10000:alert.type==='success'?4000:6000;
  const remaining=useRef(duration);
  const reduced=useReducedMotion();
  const paused=hovered || focused;
  useEffect(()=>{
    if(!visible || paused)return;
    const started=performance.now();
    // Hide the popup without erasing the form's error source in UIContext.
    const timer=setTimeout(()=>setVisible(false),remaining.current);
    return()=>{clearTimeout(timer);remaining.current=Math.max(0,remaining.current-(performance.now()-started));};
  },[visible,paused]);
  if(!visible)return null;
  const Icon=alert.type==='error'?TriangleAlert:alert.type==='success'?CheckCircle:Info;
  return <motion.div data-notification-id={alert.id} className={`app-notification ${alert.type}`} role={alert.type==='error'?'alert':'status'} initial={reduced?false:{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={reduced?{opacity:1}:{opacity:0,y:-12}} transition={{duration:reduced?0:.2}}
    onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(true);}} onPointerLeave={event=>{if(event.pointerType==='mouse')setHovered(false);}} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);}}>
    <Icon size={21} aria-hidden="true"/><p>{alert.message}</p><button type="button" aria-label="Dismiss notification" onClick={onDismiss}><X size={19} aria-hidden="true"/></button>
  </motion.div>;
}
