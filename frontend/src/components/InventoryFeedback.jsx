import {useEffect, useRef} from 'react';

export default function InventoryFeedback({message, children}) {
  const feedback = useRef(null);
  useEffect(() => {
    if (!message) return;
    feedback.current?.scrollIntoView({block: 'nearest'});
    feedback.current?.focus({preventScroll: true});
  }, [message]);
  if (!message) return null;
  return <div ref={feedback} role="alert" tabIndex={-1} className="account-error inventory-form-feedback">
    <p>{message}</p>
    {children}
  </div>;
}
