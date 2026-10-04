import {CartContext} from './CartContext';
import {responseList} from '../utils/apiResponse';
import {apiError} from '../utils/apiError';
import { useEffect, useState, useCallback } from "react";
import { getCookie } from "../utils/cookieUtils";
import { useAuth } from "./AuthContext";
import { useUI } from "./UIContext";
import axios from "axios";
import { useStorefront } from "./StorefrontContext";

export default function CartProvider({ children }) {
  const { store: promotion } = useStorefront();
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState('');

  const { isAuthenticated, cart, setCart } = useAuth();
  const { setAlert, setShowLogin } = useUI();

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const SHIPPING_FEE = total >= 50 ? 0 : 5;
  const portions = cart.reduce((n,i)=>n+i.quantity,0);
  const discount = promotion && portions >= promotion.bulk_minimum ? Math.round(total * promotion.bulk_discount_percent) / 100 : 0;
  const finalTotal = total - discount + SHIPPING_FEE;

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart([]);
      setCartLoading(false);
      return;
    }

    setCartLoading(true); setCartError('');
    try {
      const res = await axios.get("/api/cart/", { withCredentials: true, timeout:30000 });
      const data = res.data;

      setCart(responseList(data));

    } catch (err) {
      setCartError(apiError(err));
      setAlert({message:apiError(err),type:"error"});
      console.error("refreshCart:", err.response?.data || err.message);
    } finally {
      setCartLoading(false);
    }
  }, [isAuthenticated, setCart, setAlert]);

  useEffect(() => {
    if(!isAuthenticated)return;
    const controller=new AbortController();
    axios.get('/api/cart/',{withCredentials:true,signal:controller.signal}).then(({data})=>{setCart(responseList(data));setCartError('');}).catch(err=>{if(!axios.isCancel(err))setCartError(apiError(err));}).finally(()=>{if(!controller.signal.aborted)setCartLoading(false);});
    axios.get('/api/wallet/',{withCredentials:true,signal:controller.signal}).then(({data})=>setWallet(data)).catch(err=>{if(!axios.isCancel(err))setWallet(err.response?.status===404?null:false);}).finally(()=>{if(!controller.signal.aborted)setWalletLoading(false);});
    return()=>controller.abort();
  }, [isAuthenticated,setCart]);

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
  }, [setAlert])

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
  }, [setAlert]);

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
        return true;

      } catch (err) {
        const detail = err.response?.data?.detail;
        setAlert({ message: typeof detail === 'string' && detail.includes('CSRF') ? 'Your session could not be verified. Refresh the page and sign in again.' : detail || 'Could not add this item. Check your connection and try again.', type: 'error' });
        console.error("addToCart:", err.response?.data || err.message);
      }
    } else{
      setShowLogin(true);
    }
    return false;
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
        cartLoading, cartError,
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
