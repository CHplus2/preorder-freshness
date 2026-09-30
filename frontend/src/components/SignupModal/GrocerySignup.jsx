import ModalDialog from '../ModalDialog';
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useUI } from "../../contexts/UIProvider";
import { useAuth } from "../../contexts/AuthProvider";
import "./GrocerySignup.css";

function GrocerySignup() {
    const [account, setAccount] = useState({
        "username": "",
        "password": "",
        "confirmPassword": "",
        "email": "",
    });
    const { setShowSignup, setShowLogin, modalMotion } = useUI();
    const { signup } = useAuth();

    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const submitting = useRef(false);

    const handleChange = (e) => {
        setAccount({ ...account, [e.target.name]: e.target.value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (account.password !== account.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (submitting.current) return;
        submitting.current = true;
        setPending(true);
        setError("");
        try { setError(await signup(account) || ""); }
        finally { submitting.current = false; setPending(false); }
    }

    return (
        <ModalDialog label="Create account" onDismiss={() => setShowSignup(false)}>
        <div className="modal-overlay">
            <motion.div
                className="modal-content"
                {...modalMotion}
                transition= {{ ...modalMotion.transition, duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
            >
                <button className="close-btn" aria-label="Close account dialog" onClick={() => setShowSignup(false)}>✖</button>
                <h2>Register for an Account</h2>
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
                    <label>Recovery email (optional)<input type="email" name="email" autoComplete="email" maxLength={254} value={account.email} onChange={handleChange}/></label>
                    <p>Add an email if you want to reset a forgotten password.</p>
                    <label>Password<input
                        type="password"
                        name="password"
                        aria-label="Password" autoComplete="new-password"
                        placeholder="Password"
                        value={account.password}
                        onChange={handleChange}
                        required
                    /></label>
                    <label>Confirm password<input
                        type="password"
                        name="confirmPassword"
                        aria-label="Confirm password" autoComplete="new-password"
                        placeholder="Confirm Password"
                        value={account.confirmPassword}
                        onChange={handleChange}
                        required
                    /></label>
                    <button type="submit" disabled={pending}>{pending ? "Creating account..." : "Create account"}</button>
                </form>

                <p>
                    Already have an account?{" "}
                    <button type="button"
                        className="switch-link"
                        onClick={() => {
                            setShowSignup(false);
                            setShowLogin(true);
                        }}
                    >
                        Log in
                    </button>
                </p>
            </motion.div>
        </div>
        </ModalDialog>
    )
}

export default GrocerySignup;
