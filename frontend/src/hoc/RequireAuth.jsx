import {useStorefront} from '../contexts/StorefrontContext';
import PageState from '../components/PageState';
import {Link,useLocation} from 'react-router-dom';
import PageLoading from "../components/PageLoading";
import { useEffect } from "react";
import { useUI } from "../contexts/UIContext";
import { useAuth } from "../contexts/AuthContext";

export default function RequireAuth({ children, message = "Please Log in to view this page" }) {
    const { setShowLogin } = useUI();
    const { isAuthenticated, isAdmin, isGuest, startGuest, authPending, authError } = useAuth();
    const context=useStorefront();
    const {pathname}=useLocation();
    const guestFlow=context?.store?.ordering_mode==='simple' && /^\/(cart|checkout|orders|account)(?:\/|$)/.test(pathname) && message!=='Admin access required';

    useEffect(() => {
        if (isAuthenticated === false && !guestFlow) {
            setShowLogin(true);
        }
    }, [isAuthenticated, setShowLogin,guestFlow]);


    if(guestFlow && isAuthenticated===false)return authError?<PageState title="Start your order" description={authError}><button disabled={authPending} onClick={startGuest}>Try again</button></PageState>:<PageLoading label="Opening your ordering session…"/>;
    if(isGuest && message==='Admin access required')return <PageState title="Kitchen access required" description="Sign in with the kitchen’s staff account to use this workspace."><button onClick={()=>setShowLogin(true)}>Kitchen sign in</button><Link to="/menu">Browse the menu</Link></PageState>;
    if (isAuthenticated === null) return <PageLoading label="Checking account access…" />;

    if (isAuthenticated === false || (message === "Admin access required" && isAdmin === false )) {
        const signedOut=isAuthenticated===false;
        return <PageState title={signedOut?'Sign in to continue':'Kitchen access required'} description={signedOut?'Sign in to view this page. Your saved orders and account details will be available after signing in.':'This workspace is available to kitchen staff. You can still manage your own account and orders.'}>
            {signedOut?<button type="button" onClick={()=>setShowLogin(true)}>Sign in</button>:<Link to="/account">My account</Link>}<Link to="/menu">Browse the menu</Link>
        </PageState>;
    }

    return children;
}