import {OrderContext} from './OrderContext';
import {readCheckout,checkoutAttempt} from '../utils/checkoutStorage';
import {responseList,invalidResponse} from '../utils/apiResponse';
import {useUI} from './UIContext';
import {apiError} from '../utils/apiError';
import { useState, useCallback } from "react";
import { getCookie } from "../utils/cookieUtils";
import { useCart } from "./CartContext";
import axios from "axios";

export default function OrderProvider({ children }) {
    const {setAlert} = useUI();
    const [orders, setOrders] = useState([]);
    const [adminOrders, setAdminOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState('');
    const [adminOrdersLoading, setAdminOrdersLoading] = useState(true);
    const [adminOrdersError, setAdminOrdersError] = useState('');
    const { refreshCart, cart } = useCart();
    
    const fetchOrders = useCallback(async () => {
        setOrdersLoading(true); setOrdersError('');
        try {
            const res = await axios.get("/api/orders/", { 
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") }, 
            });
            const data = res.data;
            
            setOrders(responseList(data));
        } catch (err) {
            setOrdersError(apiError(err));
        } finally {
            setOrdersLoading(false);
        }
    }, []);

    const fetchAdminOrders = useCallback(async () => {
        setAdminOrdersLoading(true); setAdminOrdersError('');
        try {
            const res = await axios.get("/api/admin/orders/", {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
            const data = res.data;

            setAdminOrders(responseList(data));
        } catch (err) {
            setAdminOrdersError(apiError(err));
        } finally {
            setAdminOrdersLoading(false);
        }
    }, []);

    const placeOrder = useCallback(async (addressId, payment, options = {}) => {
        try {
            const body={address_id:addressId,payment,...readCheckout(sessionStorage,'deliveryPlan',{})};
            const key=JSON.stringify([body,cart.map(i=>[i.product.id,i.quantity])]);
            const attempt=checkoutAttempt(sessionStorage,key,()=>crypto.randomUUID());
            const placed = await axios.post("/api/orders/place/", { ...body, request_id:attempt.id, recommendation_session:sessionStorage.getItem('recommendationSession') }, {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
            if(!Number.isInteger(placed.data?.order_id) || placed.data.order_id<1)throw invalidResponse();
            // A local storage failure after server success must not report a failed order.
            try {
                sessionStorage.removeItem('checkoutAttempt');
                sessionStorage.removeItem('recommendationSession');
            } catch { /* The retained request ID is safe to replay server-side. */ }
            refreshCart();
            return true;
        } catch (err) {
            console.error("placeOrder:", err.response?.data || err.message);
            if (options.throwOnError) throw err;
            setAlert({message:apiError(err),type:"error"});
            return false;
        }
    }, [refreshCart,cart,setAlert]);

    const updateOrder = async (orderId, newStatus) => {
        try {
            await axios.patch(`/api/admin/orders/${orderId}/`, { 
                status: newStatus
            }, {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
            return true;
        } catch (err) {
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
