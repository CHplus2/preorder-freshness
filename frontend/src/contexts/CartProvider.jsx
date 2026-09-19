import {apiError} from '../utils/apiError';
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCookie } from "../utils/cookieUtils";
import { useAuth } from "./AuthProvider";
import { useUI } from "./UIProvider";
import axios from "axios";

export const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}

export default function CartProvider({ children }) {
  const [promotion, setPromotion] = useState(null);
  useEffect(()=>{axios.get("/api/storefront/").then(r=>setPromotion(r.data)).catch(()=>{});},[]);
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);

  const { isAuthenticated, cart, setCart } = useAuth();
  const { setAlert, setShowLogin } = useUI();

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const SHIPPING_FEE = total >= 50 ? 0 : 5;
  const portions = cart.reduce((n,i)=>n+i.quantity,0);
  const discount = promotion && portions >= promotion.bulk_minimum ? Math.round(total * promotion.bulk_discount_percent) / 100 : 0;
  const finalTotal = total - discount + SHIPPING_FEE;

  const fetchWallet = useCallback(async () => {
    try {
      const res = await axios.get("/api/wallet/", { withCredentials: true });
      setWallet(res.data);
    } catch (err) {

      if (err.response?.status === 404) {
        setWallet(null);
      } else {
        setWallet(false);
      }

      console.error("fetchWallet:", err.response?.data || err.message);
    } finally {
      setWalletLoading(false);
    }
  }, [])


  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart([]);
      return;
    }

    try {
      const res = await axios.get("/api/cart/", { withCredentials: true });
      const data = res.data;

      setCart(Array.isArray(data) ? data : data.results || []);

    } catch (err) {
      setAlert({message:apiError(err),type:"error"});
      console.error("refreshCart:", err.response?.data || err.message);
    }
  }, [isAuthenticated, setCart]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWallet();
      refreshCart();
    }
  }, [fetchWallet, refreshCart]);

  const createWallet = useCallback(async () => {
    try {
      const res = await axios.post("/api/wallet/create/", {}, {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      })
      setWallet(res.data);

    } catch (err) {
      setWallet(false);
      setAlert({ message: apiError(err, "Failed to create wallet"), type: "error"})
      console.error("createWallet:", err.response?.data || err.message);
    }
  }, [])

  const topupWallet = useCallback(async (amount) => {
    try {
      const res = await axios.post("/api/wallet/topup/", { amount }, {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      })
      setWallet(prev => ({...prev, "balance": res.data.balance}));

    } catch (err) {
      setWallet(false);
      setAlert({ message: apiError(err, "Failed to top up wallet"), type: "error"})
      console.error("topupWallet:", err.response?.data || err.message);
    }
  }, []);

  const addToCart = async (productId, quantity = 1) => {
    if (isAuthenticated) {
      try {
        await axios.post("/api/cart/",
          { product_id: productId, quantity },
          {
            withCredentials: true,
            headers: { "X-CSRFToken": getCookie("csrftoken") }
          }
        );

        setAlert({ message: "Item added to cart", type: "success" });
        refreshCart();

      } catch (err) {
        const detail = err.response?.data?.detail;
        setAlert({ message: typeof detail === 'string' && detail.includes('CSRF') ? 'Your session could not be verified. Refresh the page and sign in again.' : detail || 'Could not add this item. Check your connection and try again.', type: 'error' });
        console.error("addToCart:", err.response?.data || err.message);
      }
    } else{
      setShowLogin(true);
    }
  };

  const removeFromCart = async (cartItemId) => {
    try {
      await axios.delete(`/api/cart/${cartItemId}/`, {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      })

      refreshCart();
    } catch (err) {

      setAlert({ message: apiError(err, "Failed to remove item from cart"), type: "error" });
      console.error("removeFromCart:", err.response?.data || err.message);
    }
  };

  const updateQuantity = async (cartItemId, quantity) => {
    if (quantity <= 0) return removeFromCart(cartItemId);

    try {
      await axios.patch(`/api/cart/${cartItemId}/`, { quantity }, {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") }
      });

      refreshCart();
    } catch (err) {

      setAlert({ message: apiError(err, "Failed to update cart item quantity"), type: "error" });
      console.error("updateQuantity:", err.response?.data || err.message);
    }
  };

  return (
    <CartContext.Provider
      value={{
        discount, promotion,
        cart,
        total,
        finalTotal,
        SHIPPING_FEE,
        refreshCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        wallet, walletLoading,
        createWallet, topupWallet
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
