import { useState } from 'react';
import { useUI } from '../contexts/UIProvider';

// Keep newly raised errors inside the native modal's accessible surface.
export default function DialogFeedback() {
  const { alert } = useUI();
  const [initial] = useState(alert);
  return alert !== initial && alert.type === 'error'
    ? <p role="alert" className="account-error">{alert.message}</p> : null;
}
