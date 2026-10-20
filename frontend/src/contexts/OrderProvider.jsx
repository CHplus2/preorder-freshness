import {OrderContext} from './OrderContext';
import {readCheckout,checkoutAttempt} from '../utils/checkoutStorage';
import {responseList,invalidResponse} from '../utils/apiResponse';
import {useUI} from './UIContext';
import {apiError} from '../utils/apiError';
import { useState, useCallback } from "react";
import { getCookie } from "../utils/cookieUtils";
import { useCart } from "./CartContext";
import axios from "axios";
import {useAuth} from './AuthContext';
import {accountChanged} from '../utils/sessionScope';

export default function OrderProvider({ children }) {
    const {isAuthenticated,isAdmin,isSessionCurrent,accountKey}=useAuth();
    const {setAlert} = useUI();
    const [orders, setOrders] = useState([]);
    const [adminOrders, setAdminOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState('');
    const [adminOrdersLoading, setAdminOrdersLoading] = useState(true);
    const [adminOrdersError, setAdminOrdersError] = useState('');
    const { refreshCart, cart } = useCart();
    
    const fetchOrders = useCallback(async () => {
        if(!isAuthenticated || !isSessionCurrent())return;
        setOrdersLoading(true); setOrdersError('');
        try {
            const res = await axios.get("/api/orders/", { 
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") }, 
            });
            const data = res.data;
            
            if(isSessionCurrent())setOrders(responseList(data));
        } catch (err) {
            if(isSessionCurrent())setOrdersError(apiError(err));
        } finally {
            if(isSessionCurrent())setOrdersLoading(false);
        }
    }, [isAuthenticated,isSessionCurrent]);

    const fetchAdminOrders = useCallback(async () => {
        if(!isAdmin || !isSessionCurrent())return;
        setAdminOrdersLoading(true); setAdminOrdersError('');
        try {
            const res = await axios.get("/api/admin/orders/", {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
            const data = res.data;

            if(isSessionCurrent())setAdminOrders(responseList(data));
        } catch (err) {
            if(isSessionCurrent())setAdminOrdersError(apiError(err));
        } finally {
            if(isSessionCurrent())setAdminOrdersLoading(false);
        }
    }, [isAdmin,isSessionCurrent]);

    const placeOrder = useCallback(async (addressId, payment, options = {}) => {
        try {
            if(!isAuthenticated || !isSessionCurrent())throw accountChanged();
            const body={address_id:addressId,payment,...readCheckout(sessionStorage,'deliveryPlan',{})};
            const key=JSON.stringify([accountKey,body,cart.map(i=>[i.product.id,i.quantity])]);
            const attempt=checkoutAttempt(sessionStorage,key,()=>crypto.randomUUID());
            const placed = await axios.post("/api/orders/place/", { ...body, request_id:attempt.id, recommendation_session:sessionStorage.getItem('recommendationSession') }, {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
            if(!isSessionCurrent())throw accountChanged();
            if(!Number.isInteger(placed.data?.order_id) || placed.data.order_id<1)throw invalidResponse();
            // A local storage failure after server success must not report a failed order.
            try {
                sessionStorage.removeItem('checkoutAttempt');
                sessionStorage.removeItem('recommendationSession');
            } catch { /* The retained request ID is safe to replay server-side. */ }
            refreshCart();
            return placed.data;
        } catch (err) {
            if(!isSessionCurrent()){if(options.throwOnError)throw accountChanged();return false;}
            console.error("placeOrder:", err.response?.data || err.message);
            if (options.throwOnError) throw err;
            setAlert({message:apiError(err),type:"error"});
            return false;
        }
    }, [refreshCart,cart,setAlert,accountKey,isAuthenticated,isSessionCurrent]);

    const updateOrder = async (orderId, newStatus) => {
        if(!isAdmin || !isSessionCurrent())return false;
        try {
            await axios.patch(`/api/admin/orders/${orderId}/`, { 
                status: newStatus
            }, {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
            return isSessionCurrent();
        } catch (err) {
            if(!isSessionCurrent())return false;
            setAlert({message:apiError(err),type:"error"});
            return false;
        }
    }

    const value = {
        orders, adminOrders, ordersLoading, ordersError, adminOrdersLoading, adminOrdersError,
        setOrders, setAdminOrders, fetchOrders, fetchAdminOrders, placeOrder, updateOrder
    }
    
    return <OrderContext.Provider value={value}>
        {children}
    </OrderContext.Provider>
}
