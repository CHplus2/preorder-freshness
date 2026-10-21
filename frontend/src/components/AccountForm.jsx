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
  const [account,setAccount]=useState({username:'',password:'',confirmPassword:'',email:''}),[localError,setLocalError]=useState('');
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
    try{await (create?signup(account):login({username:account.username,password:account.password}));}
    finally{submitting.current=false;}
  };
  return <ModalDialog label={create?'Create account':'Sign in'} onDismiss={dismiss}><div className="modal-overlay account-overlay"><section className="modal-content account-form-card" aria-labelledby="account-form-title">
    <button className="account-close" type="button" aria-label="Close account dialog" onClick={dismiss}><X size={21} aria-hidden="true"/></button>
    <span className="dk-eyebrow">YOUR KITCHEN ACCOUNT</span><h2 id="account-form-title">{create?'Create your account':'Welcome back'}</h2>
    <p className="account-form-intro">{create?'Save your delivery details and follow your orders.':'Sign in to order food and follow your deliveries.'}</p>
    {error && <div className="account-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
    <form onSubmit={submit} aria-busy={authPending || false}>
      <fieldset disabled={authPending} className="account-form-fields"><label>Username<input name="username" autoComplete="username" maxLength={150} data-initial-focus value={account.username} onChange={change} required aria-describedby={create?'username-hint':undefined}/></label>
      {create && <><p id="username-hint" className="account-form-hint">Use letters, numbers or @ . + - _</p><label>Recovery email (optional)<input name="email" type="email" autoComplete="email" maxLength={254} value={account.email} onChange={change} aria-describedby="recovery-hint"/></label><p id="recovery-hint" className="account-form-hint">Add an email so you can reset a forgotten password.</p></>}
      <PasswordField name="password" value={account.password} onChange={change} required autoComplete={create?'new-password':'current-password'} minLength={create?8:undefined} hintId={create?'password-hint':undefined}/>
      {create && <><p id="password-hint" className="account-form-hint">At least 8 characters. Avoid common passwords, only numbers, or a password similar to your username.</p><PasswordField label="Confirm password" inputRef={confirmRef} name="confirmPassword" value={account.confirmPassword} onChange={change} required autoComplete="new-password"/></>}
      </fieldset><button className="account-primary" disabled={authPending} type="submit">{authPending?(create?'Creating account…':'Signing in…'):(create?'Create account':'Sign in')}</button>
    </form>
    {!create && <Link className="account-recovery-link" to="/recover" onClick={dismiss}>Forgot your password?</Link>}
    <div className="account-form-switch"><span>{create?'Already have an account?':'New to the kitchen?'}</span><button type="button" disabled={authPending} onClick={switchMode}>{create?'Sign in':'Create an account'}</button></div>
  </section></div></ModalDialog>;
}
