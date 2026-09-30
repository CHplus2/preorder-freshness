import {useUI} from './UIProvider';
import {apiError} from '../utils/apiError';
import { createContext, useContext, useState, useCallback } from "react";
import { getCookie } from "../utils/cookieUtils";
import { useCart } from "./CartProvider";
import axios from "axios";

const OrderContext = createContext();
export const useOrder = () => useContext(OrderContext);

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
            
            setOrders(Array.isArray(data) ? data : data.results || []);
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

            setAdminOrders(Array.isArray(data) ? data : data.results || []);
        } catch (err) {
            setAdminOrdersError(apiError(err));
        } finally {
            setAdminOrdersLoading(false);
        }
    }, []);

    const placeOrder = useCallback(async (addressId, payment, options = {}) => {
        try {
            const body={address_id:addressId,payment,...JSON.parse(sessionStorage.getItem('deliveryPlan') || '{}')};
            const key=JSON.stringify([body,cart.map(i=>[i.product.id,i.quantity])]);
            let attempt=JSON.parse(sessionStorage.getItem('checkoutAttempt') || 'null');
            if(!attempt || attempt.key!==key){attempt={key,id:crypto.randomUUID()};sessionStorage.setItem('checkoutAttempt',JSON.stringify(attempt))}
            await axios.post("/api/orders/place/", { ...body, request_id:attempt.id, recommendation_session:sessionStorage.getItem('recommendationSession') }, {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            })
            sessionStorage.removeItem('checkoutAttempt');
            sessionStorage.removeItem('recommendationSession');
            refreshCart();
            return true;
        } catch (err) {
            console.error("placeOrder:", err.response?.data || err.message);
            if (options.throwOnError) throw err;
            setAlert({message:apiError(err),type:"error"});
            return false;
        }
    }, [refreshCart,cart]);

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
