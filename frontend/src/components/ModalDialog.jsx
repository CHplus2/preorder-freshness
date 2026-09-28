import { useEffect, useRef } from 'react';
import './ModalDialog.css';

// Native modal semantics contain keyboard focus and make the page behind inert.
export default function ModalDialog({ children, onDismiss, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={ref} className="account-dialog" aria-label={label}
    onCancel={event => { event.preventDefault(); onDismiss(); }}>
    {children}
  </dialog>;
}
