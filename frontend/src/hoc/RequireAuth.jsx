import PageLoading from "../components/PageLoading";
import { useEffect } from "react";
import { useUI } from "../contexts/UIProvider";
import { useAuth } from "../contexts/AuthProvider";

export default function RequireAuth({ children, message = "Please Log in to view this page" }) {
    const { setShowLogin } = useUI();
    const { isAuthenticated, isAdmin } = useAuth();

    useEffect(() => {
        if (isAuthenticated === false) {
            setShowLogin(true);
        }
    }, [isAuthenticated, setShowLogin]);


    if (isAuthenticated === null) return <PageLoading label="Loading account..." />;

    if (isAuthenticated === false || (message === "Admin access required" && isAdmin === false )) {
        return (
            <div className="auth-blocked">
                <p>{message}</p>
            </div>
        )
    } 

    return children;
}