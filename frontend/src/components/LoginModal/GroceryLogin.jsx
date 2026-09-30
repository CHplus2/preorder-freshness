import ModalDialog from '../ModalDialog';
import {Link} from 'react-router-dom';
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useUI } from "../../contexts/UIProvider";
import { useAuth } from "../../contexts/AuthProvider";
import "./GroceryLogin.css";

function GroceryLogin() {
    const [account, setFormData] = useState({ "username": "", "password": "" });

    const { setShowSignup, setShowLogin, modalMotion } = useUI();
    const { login } = useAuth();

    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const submitting = useRef(false);

    const handleChange = (e) => {
        setFormData({ ...account, [e.target.name]: e.target.value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setPending(true);
        setError("");
        try { setError(await login(account) || ""); }
        finally { submitting.current = false; setPending(false); }
    }

    return (
        <ModalDialog label="Sign in" onDismiss={() => setShowLogin(false)}>
        <div className="modal-overlay">
            <motion.div
                className="modal-content"
                {...modalMotion}
                transition= {{ ...modalMotion.transition, duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
            >
                <button className="close-btn" aria-label="Close account dialog" onClick={() => setShowLogin(false)}>✖</button>
                <h2>Access Your Account</h2>
                {error && <p className="account-error" role="alert">{error}</p>}
                <form onSubmit={handleSubmit} className="login-form">
                <label>Username<input
                        type="text"
                        name="username"
                        aria-label="Username" autoComplete="username"
                        placeholder="Username"
                        value={account.username}
                        onChange={handleChange}
                        required
                    /></label>
                    <label>Password<input
                        type="password"
                        name="password"
                        aria-label="Password" autoComplete="current-password"
                        placeholder="Password"
                        value={account.password}
                        onChange={handleChange}
                        required
                    /></label>
                    <button type="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
                </form>
                <p><Link to="/recover" onClick={()=>setShowLogin(false)}>Forgot your password?</Link></p>
                <p>
                    Don't have an account?{" "}
                    <button type="button"
                        className="switch-link"
                        onClick={() => {
                            setShowLogin(false);
                            setShowSignup(true);
                        }}
                    >
                        Create one
                    </button>
                </p>
            </motion.div>
        </div>
        </ModalDialog>
    )
}

export default GroceryLogin;
