import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {X} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {useUI} from '../contexts/UIContext';
import ModalDialog from './ModalDialog';
import CustomerAccessForm from './CustomerAccessForm';
const nextPath=value=>['/checkout','/orders','/cart','/account'].includes(value)?value:null;
export default function CustomerAccessModal(){
 const {customerAccess,setCustomerAccess,setShowLogin}=useUI(),{customerAccount,isAdmin,authPending}=useAuth(),navigate=useNavigate();
 useEffect(()=>{if(customerAccount||isAdmin)setCustomerAccess(null)},[customerAccount,isAdmin,setCustomerAccess]);
 if(!customerAccess||customerAccount||isAdmin)return null;
 const close=()=>{if(authPending)return;setCustomerAccess(null);const cancel=nextPath(customerAccess.cancelTo);if(cancel)navigate(cancel)};
 return <ModalDialog label="Customer account" onDismiss={close} fallbackFocusSelector="[data-account-entry]"><div className="modal-overlay customer-access-overlay account-auth-overlay"><section className="modal-content customer-access-modal account-auth-card"><button className="account-close" type="button" disabled={authPending} onClick={close} aria-label="Close customer account"><X size={20} aria-hidden="true"/></button><CustomerAccessForm initialMode={customerAccess.mode||'create'} checkout={customerAccess.next==='/checkout'} initialName={customerAccess.draft?.name||''} initialPhone={customerAccess.draft?.phone||''} onComplete={()=>{setCustomerAccess(null);const next=nextPath(customerAccess.next);if(next)navigate(next)}} onStaffSignIn={({mode,name,phone})=>{setCustomerAccess(current=>({...current,mode,draft:{name,phone}}));setShowLogin(true)}}/></section></div></ModalDialog>;
}
