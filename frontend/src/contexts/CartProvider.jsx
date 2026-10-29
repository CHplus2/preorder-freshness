import {CartContext} from './CartContext';
import {basketRows,basketTotals,pricingConfigured} from '../utils/checkoutPresentation';
import {apiError,readApiError} from '../utils/apiError';
import { useEffect, useState, useCallback, useRef } from "react";
import {mutationAttempt} from '../utils/checkoutStorage';
import {walletData,walletBalance} from '../utils/walletResponse';
import { getCookie } from "../utils/cookieUtils";
import { useAuth } from "./AuthContext";
import { useUI } from "./UIContext";
import axios from "axios";
import { useStorefront } from "./StorefrontContext";
import {methodsFor} from '../utils/fulfilment';
import {chosenDeliveryInput,chosenDeliveryDay,deliveryChoiceScope,activeDeliveryChoice,activeDeliveryDay,readDeliveryChoice,saveDeliveryChoice} from '../utils/deliveryChoice';
import {basketPlanAdded} from '../utils/basketGuide';

export default function CartProvider({ children }) {
  const { store: promotion,error:pricingError,refreshing:pricingRefreshing=false } = useStorefront();
  const pricingReady=pricingConfigured(promotion) && !pricingError;
  const refreshPricing=useCallback(()=>window.dispatchEvent(new Event('storefront-updated')),[]);
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState('');
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState('');

  const [cart,setCart]=useState([]);
  const { isAuthenticated, accountKey, isSessionCurrent } = useAuth();
  const [fulfilment,setFulfilment]=useState(()=>{try{const saved=JSON.parse(sessionStorage.getItem('fulfilmentChoice') || '{}');return {account:accountKey,...saved,window_minutes:saved.window_minutes ?? 60}}catch{return {account:accountKey,window_minutes:60}}});
  const options=methodsFor(promotion);
  const fulfilmentMethod=fulfilment.account===accountKey && options.includes(fulfilment.method)?fulfilment.method:options[0] || 'standard';
  const arrivalWindowMinutes=fulfilmentMethod==='pickup'?0:[0,30,60].includes(fulfilment.window_minutes)?fulfilment.window_minutes:0;
  const deliveryArea=fulfilment.account===accountKey && promotion?.delivery_areas?.includes(fulfilment.area)?fulfilment.area:'';
  const [deliveryChoice,setDeliveryChoice]=useState(()=>{try{return readDeliveryChoice(sessionStorage)}catch{return null}});
  const choiceScope=deliveryChoiceScope(accountKey,cart,promotion,fulfilmentMethod,deliveryArea,arrivalWindowMinutes);
  const preferredDelivery=activeDeliveryChoice(deliveryChoice,choiceScope);
  const preferredDeliveryDay=activeDeliveryDay(deliveryChoice,choiceScope);
  const saveChoice=record=>{setDeliveryChoice(record);try{saveDeliveryChoice(sessionStorage,record)}catch{/* Keep the choice in memory. */}};
  const chooseFulfilment=(method,area='')=>{const window_minutes=fulfilment.window_minutes ?? 60;setFulfilment({account:accountKey,method,area,window_minutes});saveChoice(null);try{sessionStorage.setItem('fulfilmentChoice',JSON.stringify({method,area,window_minutes}));}catch{/* The current choice remains usable. */}};
  const chooseArrivalWindow=minutes=>{if(![0,30,60].includes(minutes))return;setFulfilment({account:accountKey,method:fulfilmentMethod,area:deliveryArea,window_minutes:minutes});saveChoice(null);try{sessionStorage.setItem('fulfilmentChoice',JSON.stringify({method:fulfilmentMethod,area:deliveryArea,window_minutes:minutes}));}catch{/* Keep the current timing usable. */}};
  const chooseDeliveryTime=(time,{rows=cart,windowMinutes=arrivalWindowMinutes}={})=>{
    if(!isSessionCurrent() || ![0,30,60].includes(windowMinutes))return;
    const value=chosenDeliveryInput(time);
    if(windowMinutes!==arrivalWindowMinutes){
      setFulfilment({account:accountKey,method:fulfilmentMethod,area:deliveryArea,window_minutes:windowMinutes});
      try{sessionStorage.setItem('fulfilmentChoice',JSON.stringify({method:fulfilmentMethod,area:deliveryArea,window_minutes:windowMinutes}));}catch{/* Use the in-memory window. */}
    }
    saveChoice(value?{version:1,value,scope:deliveryChoiceScope(accountKey,rows,promotion,fulfilmentMethod,deliveryArea,windowMinutes)}:null);
  };
  const chooseDeliveryDay=(date,{rows=cart}={})=>{
    if(!isSessionCurrent())return;
    const day=chosenDeliveryDay(date),scope=deliveryChoiceScope(accountKey,rows,promotion,fulfilmentMethod,deliveryArea,arrivalWindowMinutes);
    if(day && activeDeliveryChoice(deliveryChoice,scope).slice(0,10)===day)return;
    saveChoice(day?{version:1,day,value:'',scope}:null);
  };
  const topupPending=useRef(false),cartRead=useRef(null),cartMutation=useRef(false);
  const [cartUpdating,setCartUpdating]=useState(false);
  const { setAlert, setShowLogin } = useUI();

  const {total,discount,shipping:SHIPPING_FEE,finalTotal}=basketTotals(cart,promotion,fulfilmentMethod);

  const refreshCart = useCallback(async () => {
    if(!isSessionCurrent())return;
    if (!isAuthenticated) {
      setCart([]);
      setCartLoading(false);
      return;
    }

    cartRead.current?.abort();
    const controller=new AbortController();cartRead.current=controller;
    setCartLoading(true);setCartError('');
    try {
      const {data}=await axios.get('/api/cart/',{withCredentials:true,timeout:30000,signal:controller.signal});
      const rows=basketRows(data);
      if(!controller.signal.aborted && isSessionCurrent()){setCart(rows);return rows;}
    }catch(error){if(!controller.signal.aborted && isSessionCurrent())setCartError(readApiError(error,'Your basket could not be loaded.'));}
    finally{if(!controller.signal.aborted && isSessionCurrent())setCartLoading(false);}
    return false;
  },[isAuthenticated,isSessionCurrent]);

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{if(active && isAuthenticated!==null)refreshCart();});
    return()=>{active=false;cartRead.current?.abort();};
  },[isAuthenticated,refreshCart]);

  useEffect(() => {
    if(!isAuthenticated)return;
    const controller=new AbortController();
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
      if(cartMutation.current || cartLoading || cartError)return false;
      cartMutation.current=true;setCartUpdating(true);
      try {
        await axios.post('/api/cart/', {product_id:productId,quantity}, {
          withCredentials:true,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}
        });
        if(!isSessionCurrent())return false;
        setAlert({message:'Item added to cart',type:'success'});
        await refreshCart();
        return true;
      }catch(error){
        if(!isSessionCurrent())return false;
        const uncertain=!error.response || error.response.status>=500;
        setAlert({type:'error',message:uncertain?'The basket addition could not be confirmed. Check your basket before trying again.':apiError(error,'Could not add this item.')});
        if(uncertain)await refreshCart();
      }finally{cartMutation.current=false;if(isSessionCurrent())setCartUpdating(false);}
    } else{
      setShowLogin(true);
    }
    return false;
  };

  const changeCart=async(cartItemId,quantity)=>{
    if(cartMutation.current || !isSessionCurrent() || cartError || cartLoading)return false;
    cartMutation.current=true;setCartUpdating(true);
    try{
      const headers={'X-CSRFToken':getCookie('csrftoken')};
      if(quantity===0)await axios.delete(`/api/cart/${cartItemId}/`,{withCredentials:true,timeout:30000,headers});
      else await axios.patch(`/api/cart/${cartItemId}/`,{quantity},{withCredentials:true,timeout:30000,headers});
      if(!isSessionCurrent())return false;
      await refreshCart();return true;
    }catch(error){
      if(isSessionCurrent()){
        setAlert({type:'error',message:!error.response || error.response.status>=500?'The basket change could not be confirmed. Refresh your basket before trying again.':apiError(error)});
        await refreshCart();
      }
      return false;
    }finally{cartMutation.current=false;if(isSessionCurrent())setCartUpdating(false);}
  };
  const addSuggestedBasket=async (selection,expected)=>{
    if(!isSessionCurrent())return false;
    if(!isAuthenticated){setShowLogin(true);return false;}
    if(cartMutation.current || cartLoading || cartError)return false;
    cartMutation.current=true;setCartUpdating(true);
    try{
      const response=await axios.post('/api/menu/basket-guide/add/',selection,{withCredentials:true,timeout:30000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
      if(!isSessionCurrent())return false;
      const result=basketPlanAdded(response.data,expected);
      const rows=await refreshCart();
      if(rows && !result.basket_changed){
        if(result.date_only)chooseDeliveryDay(result.date,{rows});
        else chooseDeliveryTime(result.delivery_at,{rows,windowMinutes:0});
      }
      return result;
    }catch(error){
      if(!isSessionCurrent())return false;
      const uncertain=!error.response || error.response.status>=500 || error.code==='INVALID_RESPONSE';
      setAlert({type:'error',message:uncertain?'The basket addition could not be confirmed. Review your basket before searching or trying again.':apiError(error,'Could not add this basket option.')});
      await refreshCart();return false;
    }finally{cartMutation.current=false;if(isSessionCurrent())setCartUpdating(false);}
  };
  const removeFromCart=id=>changeCart(id,0);
  const updateQuantity=(id,quantity)=>changeCart(id,Math.max(0,quantity));

  return (
    <CartContext.Provider
      value={{
        fulfilmentMethod,deliveryArea,chooseFulfilment,arrivalWindowMinutes,chooseArrivalWindow,preferredDelivery,chooseDeliveryTime,preferredDeliveryDay,chooseDeliveryDay,
        discount, promotion, pricingReady, pricingError, pricingRefreshing, refreshPricing,
        cart,
        cartLoading, cartError, cartUpdating,
        total,
        finalTotal,
        SHIPPING_FEE,
        refreshCart,
        addToCart,
        addSuggestedBasket,
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
