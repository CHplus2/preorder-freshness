import {ProductContext} from './ProductContext';
import {apiError} from '../utils/apiError';
import { useEffect, useState, useCallback } from "react";
import { getCookie } from "../utils/cookieUtils";
import { useUI } from "./UIContext";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import axios from "axios";

export default function ProductProvider({ children }) {
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [productIdToDelete, setProductIdToDelete] = useState(null);

    const { setAlert } = useUI();
    const { isAuthenticated } = useAuth();
    const { refreshCart } = useCart();

    const fetchCategories = useCallback(async () => {
        try {
            const res = await axios.get("/api/categories/");
            const data = res.data;

            setCategories(Array.isArray(data) ? data : data.results || []);

        } catch (err) {
            setAlert({message:apiError(err),type:"error"});
            console.error("fetchCategories:", err.response?.data || err.message);
        }

    }, [setAlert]);

    const fetchProducts = useCallback(async (preview = false) => {
        try {
            const res = await axios.get(preview ? "/api/menu/" : "/api/products/");
            const data = res.data;

            setProducts(Array.isArray(data) ? data : data.results || []);

        } catch (err) {
            setAlert({message:apiError(err),type:"error"});
            console.error("fetchProducts:", err.response?.data || err.message);
        }
    }, [setAlert]);

    const fetchRecommendation = useCallback(async () => {
        if (!isAuthenticated) { setRecommended([]); return; }
        if (isAuthenticated) {
            try {
                const res = await axios.get("/api/recommendation");
                const data = res.data;

                setRecommended(Array.isArray(data) ? data : data.results || []);

            } catch (err) {
                setRecommended([]);
                console.error("fetchRecommendation:", err.response?.data || err.message);
            }
        }
    }, [isAuthenticated])

    useEffect(() => {
        const controller=new AbortController();
        axios.get('/api/categories/',{signal:controller.signal}).then(({data})=>setCategories(Array.isArray(data)?data:data.results || [])).catch(err=>{if(!axios.isCancel(err))setAlert({type:'error',message:apiError(err)});});
        return()=>controller.abort();
    }, [setAlert]);


    const addProduct = async (product, {onError}={}) => {
        try {
            await axios.post("/api/admin/products/add/", product, {
                timeout: 20000,
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            });

            setAlert({ message: "Menu created.", type: "success" });
            fetchProducts();
            return true;

        } catch (err) {
            if(onError)onError(err);
            else setAlert({ message: apiError(err, "Could not create this menu."), type: "error"});
            return false;
        }
    }

    const updateProduct = async (product, {onError}={}) => {
        try {
            await axios.patch(`/api/admin/products/${product.id}/`, product, {
                timeout: 20000,
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") }
            })
            setAlert({ message: "Menu updated.", type: "success" });
            fetchProducts();
            return true;

        } catch (err) {
            if(onError)onError(err);
            else setAlert({ message: apiError(err, "Could not save this menu."), type: "error"});
            return false;
        } 
    }

    const deleteProduct = async (productId, {onError}={}) => {
        try {
            await axios.delete(`/api/admin/products/${productId}/`, {
                timeout: 20000,
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken"), }
            });
    
            setProductIdToDelete(null);
            setProducts(previous=>previous.filter(product=>product.id!==productId));
            setAlert({ message: "Menu deleted.", type: "success" });

            fetchProducts();
            refreshCart();
            return true;

        } catch (err) {
            if(onError)onError(err);
            else setAlert({ message: apiError(err, "Could not delete this menu."), type: "error" });
            return false;
        }
    }; 

    const value = { 
        categories, products, recommended, setCategories, setProducts, setRecommended,
        fetchCategories, fetchProducts, fetchRecommendation, deleteProduct,
        productIdToDelete, setProductIdToDelete, addProduct, updateProduct
    }

    return <ProductContext.Provider value={value}>
        {children}
    </ProductContext.Provider>
}
