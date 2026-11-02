import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {X} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {useUI} from '../contexts/UIContext';
import ModalDialog from './ModalDialog';
import PasswordField from './PasswordField';
import './AccountForms.css';

export default function AccountForm({create=false}) {
  const {login,signup,authError,clearAuthError,authPending}=useAuth();
  const {setShowLogin,setShowSignup}=useUI();
  const [account,setAccount]=useState({identifier:'',first_name:'',password:'',confirmPassword:'',email:''}),[localError,setLocalError]=useState(''),[usernameOnly,setUsernameOnly]=useState(false);
  const error=localError || authError,errorRef=useRef(null),confirmRef=useRef(null),submitting=useRef(false);
  useEffect(()=>{if(errorRef.current){errorRef.current.focus();errorRef.current.scrollIntoView({block:'nearest'});}},[error]);
  const dismiss=()=>{clearAuthError();setShowLogin(false);setShowSignup(false);};
  const switchMode=()=>{clearAuthError();setShowLogin(create);setShowSignup(!create);};
  const change=event=>{setAccount(previous=>({...previous,[event.target.name]:event.target.value}));setLocalError('');clearAuthError();};
  const submit=async event=>{
    event.preventDefault();if(submitting.current || authPending)return;
    setLocalError('');clearAuthError();
    if(create && account.password!==account.confirmPassword){setLocalError('Passwords do not match. Re-enter the confirmation password.');return;}
    submitting.current=true;
    try{await (create?signup({email:account.email,first_name:account.first_name,password:account.password,confirmPassword:account.confirmPassword}):login({[usernameOnly?'username':'identifier']:account.identifier,password:account.password}));}
    finally{submitting.current=false;}
  };
  return <ModalDialog label={create?'Create account':'Sign in'} onDismiss={dismiss}><div className="modal-overlay account-overlay"><section className="modal-content account-form-card" aria-labelledby="account-form-title">
    <button className="account-close" type="button" aria-label="Close account dialog" onClick={dismiss}><X size={21} aria-hidden="true"/></button>
    <span className="dk-eyebrow">YOUR KITCHEN ACCOUNT</span><h2 id="account-form-title">{create?'Create your account':'Welcome back'}</h2>
    <p className="account-form-intro">{create?'Save your delivery details and follow your orders.':'Sign in to order food and follow your deliveries.'}</p>
    {error && <div className="account-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
    <form onSubmit={submit} aria-busy={authPending || false}>
      <fieldset disabled={authPending} className="account-form-fields">{create?<>
      <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} data-initial-focus value={account.email} onChange={change} required aria-describedby="recovery-hint"/></label><p id="recovery-hint" className="account-form-hint">Use this email to sign in and recover your password. Delivery reminders are optional for each order.</p>
      <label>Your name (optional)<input name="first_name" autoComplete="given-name" maxLength={150} value={account.first_name} onChange={change}/></label>
      </>:<label>{usernameOnly?'Existing username':'Email or username'}<input name="identifier" type="text" autoComplete="username" maxLength={usernameOnly?150:254} data-initial-focus autoCapitalize="none" spellCheck={false} value={account.identifier} onChange={change} required/></label>}
      <PasswordField name="password" value={account.password} onChange={change} required autoComplete={create?'new-password':'current-password'} minLength={create?8:undefined} hintId={create?'password-hint':undefined}/>
      {create && <><p id="password-hint" className="account-form-hint">At least 8 characters. Avoid common passwords, only numbers, or a password similar to your name or email.</p><PasswordField label="Confirm password" inputRef={confirmRef} name="confirmPassword" value={account.confirmPassword} onChange={change} required autoComplete="new-password"/></>}
      </fieldset><button className="account-primary" disabled={authPending} type="submit">{authPending?(create?'Creating account…':'Signing in…'):(create?'Create account':'Sign in')}</button>
    </form>
    {!create && <div className="account-signin-help"><Link className="account-recovery-link" to="/recover" onClick={dismiss}>Forgot your password?</Link><button type="button" className="account-legacy-toggle" aria-pressed={usernameOnly} disabled={authPending} onClick={()=>{setUsernameOnly(value=>!value);setLocalError('');clearAuthError();}}>{usernameOnly?'Use email or username':'Use an exact older username'}</button></div>}
    <div className="account-form-switch"><span>{create?'Already have an account?':'New to the kitchen?'}</span><button type="button" disabled={authPending} onClick={switchMode}>{create?'Sign in':'Create an account'}</button></div>
  </section></div></ModalDialog>;
}
