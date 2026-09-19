import {apiError} from '../utils/apiError';
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCookie } from "../utils/cookieUtils";
import { useUI } from "./UIProvider";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [isAdmin, setIsAdmin] = useState(null);
    const [cart, setCart] = useState([]);
    const { setAlert, setDropdownOpen, setShowSignup, setShowLogin } = useUI();

    const checkAuth = useCallback(async () => {
      try {
        const res = await axios.get("/api/check-auth/", { withCredentials: true })
        setIsAuthenticated(res.data.authenticated);
        setIsAdmin(res.data.is_admin); 

      } catch (err) {
        setIsAuthenticated(false);
        setIsAdmin(false);

        console.error("checkAuth:", err.response?.data || err.message);
      }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth])

    const signup = async (account) => {
      try {
        await axios.post("/api/signup/", account, { 
            withCredentials: true,
            headers: { "X-CSRFToken": getCookie("csrftoken") }, 
        });

        checkAuth();
        setShowSignup(false);

      } catch (err) {
        setAlert({ message: apiError(err, "Signup failed"), type: "error" });
        console.error("signup:", err.response?.data || err.message);
      }
    }

    const login = async (account) => {
      try {
        await axios.post("/api/login/", account, { 
            withCredentials: true,
            headers: { "X-CSRFToken": getCookie("csrftoken") }, 
        });

        checkAuth();
        setShowLogin(false);
      } catch (err) {
          setAlert({ message: apiError(err, "Invalid username or password"), type: "error" });
          console.error("login:", err.response?.data || err.message);
      }
    }

    const logout = async () => {
      try {
        await axios.post("/api/logout/", {}, {
          withCredentials: true,
          headers: { "X-CSRFToken": getCookie("csrftoken") },
        });
        setCart([]);
        checkAuth();
        setDropdownOpen(false);
    } catch (err) {
      setAlert({ message: apiError(err, "An error occurred while logging out"), type: "error" });
      console.error("logout:", err.response?.data || err.message);
    }
  }

  return <AuthContext.Provider
    value={{isAuthenticated, isAdmin, cart, setIsAuthenticated, setIsAdmin, setCart, checkAuth, signup, login, logout}}
  >
    {children}
  </AuthContext.Provider>
}