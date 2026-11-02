import PageState from '../components/PageState';
import {Link} from 'react-router-dom';
import PageLoading from "../components/PageLoading";
import { useEffect } from "react";
import { useUI } from "../contexts/UIContext";
import { useAuth } from "../contexts/AuthContext";

export default function RequireAuth({ children, message = "Please Log in to view this page" }) {
    const { setShowLogin } = useUI();
    const { isAuthenticated, isAdmin } = useAuth();

    useEffect(() => {
        if (isAuthenticated === false) {
            setShowLogin(true);
        }
    }, [isAuthenticated, setShowLogin]);


    if (isAuthenticated === null) return <PageLoading label="Checking account access…" />;

    if (isAuthenticated === false || (message === "Admin access required" && isAdmin === false )) {
        const signedOut=isAuthenticated===false;
        return <PageState title={signedOut?'Sign in to continue':'Kitchen access required'} description={signedOut?'Sign in to view this page. Your saved orders and account details will be available after signing in.':'This workspace is available to kitchen staff. You can still manage your own account and orders.'}>
            {signedOut?<button type="button" onClick={()=>setShowLogin(true)}>Sign in</button>:<Link to="/account">My account</Link>}<Link to="/menu">Browse the menu</Link>
        </PageState>;
    }

    return children;
}