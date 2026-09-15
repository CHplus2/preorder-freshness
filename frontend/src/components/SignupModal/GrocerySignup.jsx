import { useState } from "react";
import { motion } from "framer-motion";
import { useUI } from "../../contexts/UIProvider";
import { useAuth } from "../../contexts/AuthProvider";
import axios from "axios"
import "./GrocerySignup.css";

function GrocerySignup() {
    const [account, setAccount] = useState({
        "username": "",
        "password": "",
        "confirmPassword": "",
    });
    const { setShowSignup, setShowLogin, modalMotion, setAlert } = useUI();
    const { signup } = useAuth();

    const handleChange = (e) => {
        setAccount({ ...account, [e.target.name]: e.target.value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (account.password !== account.confirmPassword) {
            setAlert({ message: "Passwords do not match", type: "error" });
            return;
        }

        await signup(account);

        setAccount({ "username": "", "password": "", "confirmPassword": "" });
    }

    return (
        <div className="modal-overlay">
            <motion.div
                className="modal-content"
                role="dialog" aria-modal="true" aria-label="Account access"
                {...modalMotion}
                transition= {{ ...modalMotion.transition, duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
            >
                <button className="close-btn" aria-label="Close account dialog" onClick={() => setShowSignup(false)}>✖</button>
                <h2>Register for an Account</h2>
                <form onSubmit={handleSubmit} className="login-form">
                    <input
                        type="text"
                        name="username"
                        aria-label="Username" autoComplete="username"
                        placeholder="Username"
                        value={account.username}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="password"
                        name="password"
                        aria-label="Password" autoComplete="new-password"
                        placeholder="Password"
                        value={account.password}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="password"
                        name="confirmPassword"
                        aria-label="Confirm password" autoComplete="new-password"
                        placeholder="Confirm Password"
                        value={account.confirmPassword}
                        onChange={handleChange}
                        required
                    />
                    <button type="submit">Create Account</button>
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
    )
}

export default GrocerySignup;
