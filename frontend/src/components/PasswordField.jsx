import {useId,useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
import './AccountForms.css';

export default function PasswordField({label='Password',inputRef,hintId,...props}) {
  const [visible,setVisible]=useState(false),id=useId();
  return <div className="password-field"><label htmlFor={id}>{label}</label><div className="password-control">
    <input {...props} id={id} ref={inputRef} type={visible?'text':'password'} aria-describedby={hintId} maxLength={128}/>
    <button type="button" className="password-toggle" aria-label={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={id} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={18} aria-hidden="true"/>:<Eye size={18} aria-hidden="true"/>}<span>{visible?'Hide':'Show'}</span></button>
  </div></div>;
}
