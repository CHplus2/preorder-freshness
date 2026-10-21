import {AuthContext} from './AuthContext';
import {accountRequestError} from '../utils/accountForms';
import {Fragment,useEffect,useState,useCallback,useMemo,useRef} from 'react';
import {getCookie} from '../utils/cookieUtils';
import {authSession,syncBrowserScope,announceSessionChange,SESSION_SIGNAL} from '../utils/sessionScope';
import {useUI} from './UIContext';
import axios from 'axios';

export default function AuthProvider({children}){
 const [session,setSession]=useState({isAuthenticated:null,isAdmin:null,accountKey:null});
 const [version,setVersion]=useState(0);
 const scope=useRef(0),identity=useRef(null),authRequest=useRef(0),controller=useRef(null);
 const accountChangeBusy=useRef(false);
 const [authError,setAuthError]=useState(''),[authPending,setAuthPending]=useState(false);
 const clearAuthError=useCallback(()=>setAuthError(''),[]);
 const {setAlert,setDropdownOpen,setShowSignup,setShowLogin}=useUI();
 const cancelAuthChecks=useCallback(()=>{++authRequest.current;controller.current?.abort()},[]);
 const invalidate=useCallback(()=>{
  cancelAuthChecks();
  setVersion(++scope.current);
  setSession({isAuthenticated:null,isAdmin:null,accountKey:null});
 },[cancelAuthChecks]);
 const commit=useCallback(data=>{
  const next=authSession(data);
  syncBrowserScope(next.accountKey);
  if(identity.current!==next.accountKey){identity.current=next.accountKey;setVersion(++scope.current)}
  setSession(next);return next;
 },[]);
 const checkAuth=useCallback(async()=>{
  const request=++authRequest.current;
  controller.current?.abort();const current=new AbortController();controller.current=current;
  try{
   const {data}=await axios.get('/api/check-auth/',{withCredentials:true,signal:current.signal});
   if(request!==authRequest.current || current.signal.aborted)return null;
   return commit(data);
  }catch{
   if(request!==authRequest.current || current.signal.aborted)return null;
   commit({authenticated:false});return null;
  }
 },[commit]);
 useEffect(()=>{
  checkAuth();
  const refresh=()=>{if(!accountChangeBusy.current)checkAuth()};
  const changed=event=>{if(event.key===SESSION_SIGNAL){invalidate();checkAuth()}};
  window.addEventListener('focus',refresh);window.addEventListener('storage',changed);
  return()=>{cancelAuthChecks();window.removeEventListener('focus',refresh);window.removeEventListener('storage',changed)};
 },[checkAuth,invalidate,cancelAuthChecks]);
 const signIn=async(url,account)=>{
  if(accountChangeBusy.current)return 'An account change is already running.';
  accountChangeBusy.current=true;setAuthPending(true);setAuthError('');
  try{
   await axios.post(url,account,{withCredentials:true,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   invalidate();announceSessionChange();
   const next=await checkAuth();
   if(!next?.isAuthenticated){const message='The account session could not be verified. Refresh this page and sign in before continuing.';setAuthError(message);return message;}
   setAlert({message:'',type:''});setShowLogin(false);setShowSignup(false);return null;
  }catch(error){const message=accountRequestError(error,url==='/api/signup/'?'signup':'signin');setAuthError(message);return message}
  finally{accountChangeBusy.current=false;setAuthPending(false)}
 };
 const logout=async()=>{
  if(accountChangeBusy.current)return;
  accountChangeBusy.current=true;
  try{
   await axios.post('/api/logout/',{},{withCredentials:true,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   invalidate();commit({authenticated:false});announceSessionChange();
   setAlert({message:'',type:''});setDropdownOpen(false);
  }catch(error){setAlert({type:'error',message:accountRequestError(error,'logout')})}
  finally{accountChangeBusy.current=false}
 };
 // Every account/role boundary remounts private providers and pages. Requests
 // captured by an old tree cannot refill a new account's basket/order/wallet.
 const isSessionCurrent=useMemo(()=>()=>scope.current===version,[version]);
 return <AuthContext.Provider value={{...session,isSessionCurrent,checkAuth,authError,clearAuthError,authPending,login:account=>signIn('/api/login/',account),signup:account=>signIn('/api/signup/',account),logout}}>
  <Fragment key={version}>{children}</Fragment>
 </AuthContext.Provider>;
}
