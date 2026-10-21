import { useEffect, useRef } from 'react';
import './ModalDialog.css';
import {useUI} from '../contexts/UIContext';

// Native modal semantics contain keyboard focus and make the page behind inert.
export default function ModalDialog({ children, onDismiss, label }) {
  const {setAlert}=useUI();
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector('[data-initial-focus]')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      setAlert(current=>current.type==='error'?{message:'',type:''}:current);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [setAlert]);
  const containTab=event=>{
    if(event.key!=='Tab')return;
    const fields=[...ref.current.querySelectorAll('a[href],button,input,select,textarea,summary,[contenteditable="true"],[tabindex]')]
      .filter(node=>node.tabIndex>=0 && !node.matches(':disabled') && node.getClientRects().length>0);
    const first=fields[0],last=fields.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
  };
  return <dialog ref={ref} className="account-dialog" aria-label={label}
    onKeyDown={containTab}
    onCancel={event => { event.preventDefault(); onDismiss(); }}>
    {children}
  </dialog>;
}
