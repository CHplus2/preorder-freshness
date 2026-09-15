import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCookie } from "../utils/cookieUtils";
import { useUI } from "./UIProvider";
import { useAuth } from "./AuthProvider";
import { useCart } from "./CartProvider";
import axios from "axios";

const ProductContext = createContext();

export const useProduct = () => useContext(ProductContext);

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
            setCategories([]);
            console.error("fetchCategories:", err.response?.data || err.message);
        }

    }, []);

    const fetchProducts = useCallback(async () => {
        try {
            const res = await axios.get("/api/products/");
            const data = res.data;

            setProducts(Array.isArray(data) ? data : data.results || []);

        } catch (err) {
            setProducts([]);
            console.error("fetchProducts:", err.response?.data || err.message);
        }
    }, []);

    const fetchRecommendation = useCallback(async () => {
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
        fetchCategories();
        fetchProducts();
    }, [fetchProducts, fetchCategories]);

    useEffect(() => {
        fetchRecommendation();
    }, [fetchRecommendation]);

    const addProduct = async (product) => {
        try {
            await axios.post("/api/admin/products/add/", product, {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") },
            });

            setAlert({ message: "Product created successfully", type: "success" });
            fetchProducts();
            return true;

        } catch (err) {
            setAlert({ message: "Failed to add new product", type: "error"});
            console.error("addProduct:", err.response?.data || err.message);
            return false;
        }
    }

    const updateProduct = async (product) => {
        try {
            await axios.patch(`/api/admin/products/${product.id}/`, product, {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken") }
            })
            setAlert({ message: "Product updated successfully", type: "success" });
            fetchProducts();
            return true;

        } catch (err) {
            setAlert({ message: "Failed to save changes", type: "error"});
            console.error("updateProduct:", err.response?.data || err.message);
            return false;
        } 
    }

    const deleteProduct = async (productId) => {
        try {
            await axios.delete(`/api/admin/products/${productId}/`, {
                withCredentials: true,
                headers: { "X-CSRFToken": getCookie("csrftoken"), }
            });
    
            setProductIdToDelete(null);
            setAlert({ message: "Product deleted successfully", type: "success" });

            fetchProducts();
            refreshCart();

        } catch (err) {
            setAlert({ message: "Failed to delete product", type: "error" });
            console.error("deleteProduct:", err.response?.data || err.message);
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