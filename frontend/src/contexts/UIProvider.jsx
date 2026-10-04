import {UIContext} from './UIContext';
import { useState } from "react";

export default function UIProvider({ children }) {
    const [showLogin, setShowLogin] = useState(null);
    const [showSignup, setShowSignup] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(null);
    const [alert, setAlert] = useState({ message: "", type: "" });

    const fallback_img = "https://placehold.co/400x200/111827/9ca3af?text=No+Image";
    const MYR_TO_USD = 0.25;

    const modalMotion = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 20 },
        transition: { ease: [0.4, 0, 0.2, 1] }
    }

    const formatOrderNumber = (id) => {
        return `ORD-${String(id).padStart(5, "0")}`;
    }

    const convertToUSD = (rm) => {
        return (rm * MYR_TO_USD).toFixed(2);
    }

    const formatPrice = (value, currency="MYR") => {
        const n = Number(value);
        return new Intl.NumberFormat("en-MY", { 
        style: "currency", 
        currency, 
        }).format(Number.isFinite(n) ? n : 0);
    };

    const value = {
        modalMotion,
        showLogin, setShowLogin,
        showSignup, setShowSignup,
        dropdownOpen, setDropdownOpen,
        alert, setAlert,
        fallback_img,
        formatOrderNumber, convertToUSD,
        formatPrice
    }

    return <UIContext.Provider value={value}>
        {children}
    </UIContext.Provider>
}