import {CartContext} from './CartContext';
import {responseList} from '../utils/apiResponse';
import {apiError,readApiError} from '../utils/apiError';
import { useEffect, useState, useCallback, useRef } from "react";
import {mutationAttempt} from '../utils/checkoutStorage';
import {walletData,walletBalance} from '../utils/walletResponse';
import { getCookie } from "../utils/cookieUtils";
import { useAuth } from "./AuthContext";
import { useUI } from "./UIContext";
import axios from "axios";
import { useStorefront } from "./StorefrontContext";

export default function CartProvider({ children }) {
  const { store: promotion } = useStorefront();
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState('');
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState('');

  const [cart,setCart]=useState([]);
  const { isAuthenticated, accountKey, isSessionCurrent } = useAuth();
  const topupPending=useRef(false);
  const { setAlert, setShowLogin } = useUI();

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const SHIPPING_FEE = total >= 50 ? 0 : 5;
  const portions = cart.reduce((n,i)=>n+i.quantity,0);
  const discount = promotion && portions >= promotion.bulk_minimum ? Math.round(total * promotion.bulk_discount_percent) / 100 : 0;
  const finalTotal = total - discount + SHIPPING_FEE;

  const refreshCart = useCallback(async () => {
    if(!isSessionCurrent())return;
    if (!isAuthenticated) {
      setCart([]);
      setCartLoading(false);
      return;
    }

    setCartLoading(true); setCartError('');
    try {
      const res = await axios.get("/api/cart/", { withCredentials: true, timeout:30000 });
      const data = res.data;

      if(isSessionCurrent())setCart(responseList(data));

    } catch (err) {
      if(!isSessionCurrent())return;
      setCartError(apiError(err));
      setAlert({message:apiError(err),type:"error"});
      console.error("refreshCart:", err.response?.data || err.message);
    } finally {
      if(isSessionCurrent())setCartLoading(false);
    }
  }, [isAuthenticated, isSessionCurrent, setAlert]);

  useEffect(() => {
    if(!isAuthenticated)return;
    const controller=new AbortController();
    axios.get('/api/cart/',{withCredentials:true,signal:controller.signal}).then(({data})=>{setCart(responseList(data));setCartError('');}).catch(err=>{if(!axios.isCancel(err))setCartError(apiError(err));}).finally(()=>{if(!controller.signal.aborted)setCartLoading(false);});
    axios.get('/api/wallet/',{withCredentials:true,signal:controller.signal,timeout:30000}).then(({data})=>{setWallet(walletData(data));setWalletError('');}).catch(err=>{if(!axios.isCancel(err)){if(err.response?.status===404){setWallet(null);setWalletError('');}else setWalletError(readApiError(err,'Could not load your wallet.'));}}).finally(()=>{if(!controller.signal.aborted)setWalletLoading(false);});
    return()=>controller.abort();
  }, [isAuthenticated]);

  const refreshWallet = useCallback(async () => {
    if(!isSessionCurrent())return;
    setWalletLoading(true); setWalletError('');
    try {
      const {data}=await axios.get('/api/wallet/',{withCredentials:true,timeout:30000});
      if(isSessionCurrent())setWallet(walletData(data));
    } catch(err) {
      if(!isSessionCurrent())return;
      if(err.response?.status===404) setWallet(null);
      else setWalletError(readApiError(err,'Could not load your wallet.'));
    } finally {if(isSessionCurrent())setWalletLoading(false);}
  },[isSessionCurrent]);

  const createWallet = useCallback(async () => {
    if(!isSessionCurrent())return false;
    try {
      const res = await axios.post("/api/wallet/create/", {}, {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      })
      if(!isSessionCurrent())return false;
      setWallet(walletData(res.data));
      setWalletError('');
      return true;

    } catch (err) {
      if(!isSessionCurrent())return false;
      setAlert({ message: apiError(err, "Failed to create wallet"), type: "error"})
      console.error("createWallet:", err.response?.data || err.message);
      return false;
    }
  }, [setAlert,isSessionCurrent])

  const topupWallet = useCallback(async (amount) => {
    if(topupPending.current || !isSessionCurrent())return false;
    topupPending.current=true;
    try {
      const attempt=mutationAttempt(sessionStorage,'walletTopupAttempt',JSON.stringify([accountKey,String(amount)]),()=>crypto.randomUUID());
      const res = await axios.post("/api/wallet/topup/", { amount,request_id:attempt.id }, {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      })
      if(!isSessionCurrent())return false;
      const balance=walletBalance(res.data);
      setWallet(prev => prev?({...prev,balance}):prev);
      if(res.data.already_applied)setAlert({type:'info',message:'This earlier top-up was already recorded. No extra credits were added.'});
      try{sessionStorage.removeItem('walletTopupAttempt')}catch{/* A retained reference can be retried safely. */}
      return true;

    } catch (err) {
      if(!isSessionCurrent())return false;
      setAlert({ message: apiError(err, "Failed to top up wallet"), type: "error"})
      console.error("topupWallet:", err.response?.data || err.message);
      return false;
    }finally{topupPending.current=false}
  }, [setAlert,isSessionCurrent,accountKey]);

  const addToCart = async (productId, quantity = 1) => {
    if(!isSessionCurrent())return false;
    if (isAuthenticated) {
      try {
        await axios.post("/api/cart/",
          { product_id: productId, quantity },
          {
            withCredentials: true,
            headers: { "X-CSRFToken": getCookie("csrftoken") }
          }
        );

        if(!isSessionCurrent())return false;
        setAlert({ message: "Item added to cart", type: "success" });
        refreshCart();
        return true;

      } catch (err) {
        if(!isSessionCurrent())return false;
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
    if(!isSessionCurrent())return;
    try {
      await axios.delete(`/api/cart/${cartItemId}/`, {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      })

      if(isSessionCurrent())refreshCart();
    } catch (err) {
      if(!isSessionCurrent())return;
      setAlert({ message: apiError(err, "Failed to remove item from cart"), type: "error" });
      console.error("removeFromCart:", err.response?.data || err.message);
    }
  };

  const updateQuantity = async (cartItemId, quantity) => {
    if(!isSessionCurrent())return;
    if (quantity <= 0) return removeFromCart(cartItemId);

    try {
      await axios.patch(`/api/cart/${cartItemId}/`, { quantity }, {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") }
      });

      if(isSessionCurrent())refreshCart();
    } catch (err) {
      if(!isSessionCurrent())return;
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
        wallet, walletLoading, walletError, refreshWallet,
        createWallet, topupWallet
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
