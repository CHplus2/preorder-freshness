import {useEffect,useId,useRef,useState} from 'react';
import {contactPhone} from '../utils/contactPhone';
import './ContactPhoneField.css';

export default function ContactPhoneField({value,onChange,required=true,label='Phone number'}){
 const id=useId(),input=useRef(null),[touched,setTouched]=useState(false);
 const error=!required&&!String(value??'').trim()?'':contactPhone(value).error;
 useEffect(()=>{input.current?.setCustomValidity(error)},[error]);
 return <label className="contact-phone-field" htmlFor={id}>{label}<input ref={input} id={id} required={required} type="tel" autoComplete="tel" maxLength={30} placeholder="e.g. 011 1234 5678" value={value} onChange={event=>onChange(event.target.value)} onBlur={()=>setTouched(true)} onInvalid={()=>setTouched(true)} aria-invalid={touched&&!!error} aria-describedby={touched&&error?id+'-error':undefined}/>{touched&&error&&<span className="contact-phone-error" id={id+'-error'} role="alert">{error}</span>}</label>;
}
