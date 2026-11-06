import { useEffect, useRef } from 'react';
import './ModalDialog.css';
import {useUI} from '../contexts/UIContext';
import {lockBodyScroll} from '../utils/bodyScrollLock';

// Native modal semantics contain keyboard focus and make the page behind inert.
export default function ModalDialog({ children, onDismiss, label, fallbackFocusSelector }) {
  const {setAlert}=useUI();
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector('[data-initial-focus]')?.focus();
    const unlockScroll = lockBodyScroll();
    return () => {
      dialog.close();
      unlockScroll();
      setAlert(current=>current.type==='error'?{message:'',type:''}:current);
      if (opener?.isConnected) opener.focus();
      else if(fallbackFocusSelector)document.querySelector(fallbackFocusSelector)?.focus();
    };
  }, [setAlert,fallbackFocusSelector]);
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
