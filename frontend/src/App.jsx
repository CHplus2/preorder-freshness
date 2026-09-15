import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { User, Menu, X, ShoppingBag } from "lucide-react";
import { useAuth } from "./contexts/AuthProvider";
import { useUI } from "./contexts/UIProvider";
import { useProduct } from "./contexts/ProductProvider";
import AuthProvider from "./contexts/AuthProvider";
import UIProvider from "./contexts/UIProvider";
import ProductProvider from "./contexts/ProductProvider";
import { useCart } from "./contexts/CartProvider";
import CartProvider from "./contexts/CartProvider";
import OrderProvider from "./contexts/OrderProvider";
import RequireAuth from "./hoc/RequireAuth";
import GroceryLogin from "./components/LoginModal/GroceryLogin";
import GrocerySignup from "./components/SignupModal/GrocerySignup";
import DeleteProduct from "./components/DeleteProductModal/DeleteProduct";
import ProductsPage from "./pages/customer/ProductsPage";
import ProductsDetailPage from "./pages/customer/ProductDetailPage";
import CartPage from "./pages/customer/CartPage";
import OrdersPage from "./pages/customer/OrdersPage";
import CheckoutPage from "./pages/customer/CheckoutPage";
import PaymentPage from "./pages/customer/PaymentPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminInventoryPage from "./pages/admin/AdminInventoryPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminCustomersPage from "./pages/admin/AdminCustomersPage";
import StoreSettingsPage from "./pages/admin/StoreSettingsPage";
import PlannerPage from "./pages/admin/PlannerPage";
import "./App.css";
import "./dapur.css";
import "./business.css";
import StorefrontProvider, {useStorefront} from './contexts/StorefrontProvider';
import {HomePage,StoryPage,HowItWorksPage,ContactPage} from './pages/customer/BusinessPages';
import {BusinessFooter,PageMeta} from './components/BusinessLayout';

function AnimatedRoutes() {
  const location = useLocation();

  const page_motion = {
    initial: { opacity: 0, scale: 0.98, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: -10 },
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/story" element={<StoryPage/>}/>
        <Route path="/how-it-works" element={<HowItWorksPage/>}/>
        <Route path="/contact" element={<ContactPage/>}/>
        <Route path="/menu" element={<ProductsPage/>}/>
        <Route path="*" element={<main className="dk-workspace"><PageMeta title="Page not found" description="Return to the kitchen menu."/><h1>This page isn’t on the menu.</h1><Link to="/menu">Explore the menu</Link></main>}/>
        <Route path="/admin/settings" element={<RequireAuth message="Admin access required"><StoreSettingsPage/></RequireAuth>}/>
        <Route path="/admin/planner" element={<RequireAuth message="Admin access required"><PlannerPage/></RequireAuth>}/>
        <Route
          path="/"
          element={
            <motion.div
              {...page_motion}
            > <HomePage/>
            </motion.div>
          }
        />
        <Route
          path="/products/:id"
          element={
            <motion.div
              {...page_motion}
            >
              <ProductsDetailPage/>
            </motion.div>
          }
        />
        <Route
          path="/cart"
          element={
            <motion.div
              {...page_motion}
            >
              <RequireAuth message="Please log in to view your cart">
                <CartPage />
              </RequireAuth>
            </motion.div>
          }
        />
        <Route
          path="/checkout"
          element={
            <motion.div
              {...page_motion}
            >
              <RequireAuth message="Please log in to proceed to checkout">
                <CheckoutPage />
              </RequireAuth>
            </motion.div>
          }
        />
        <Route
          path="/payment/:method"
          element={
            <motion.div
              {...page_motion}
            >
              <RequireAuth message="Please log in to proceed to checkout">
                <PaymentPage />
              </RequireAuth>
            </motion.div>

          }
        />
        <Route
          path="/orders"
          element={
            <motion.div
              {...page_motion}
            >
              <RequireAuth message="Please log in to view your orders">
                <OrdersPage />
              </RequireAuth>
            </motion.div>
          }
        />
        <Route
          path="/admin/products"
          element={
            <motion.div {...page_motion}>
              <RequireAuth message="Admin access required">
                <AdminProductsPage />
              </RequireAuth>
            </motion.div>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <motion.div {...page_motion}>
              <RequireAuth message="Admin access required">
                <AdminInventoryPage />
              </RequireAuth>
            </motion.div>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <motion.div {...page_motion}>
              <RequireAuth message="Admin access required">
                <AdminOrdersPage />
              </RequireAuth>
            </motion.div>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <motion.div {...page_motion}>
              <RequireAuth message="Admin access required">
                <AdminReportsPage />
              </RequireAuth>
            </motion.div>
          }
        />
        <Route
          path="/admin/customers"
          element={
            <motion.div {...page_motion}>
              <RequireAuth message="Admin access required">
                <AdminCustomersPage />
              </RequireAuth>
            </motion.div>
          }
        />
      </Routes>
    </AnimatePresence>
  )
}

function AppContent() {
  const {store}=useStorefront();
  const {cart}=useCart();
  const location=useLocation();
  const [mobileOpen,setMobileOpen]=useState(false);
  const ownerPage=location.pathname.startsWith('/admin/');
  const publicLinks=[['/','Home'],['/story','Our story'],['/menu','Menu'],['/how-it-works','How it works'],['/contact','Contact']];
  const closeMenu=()=>setMobileOpen(false);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[location.pathname]);
  const { showLogin, setShowLogin, showSignup, dropdownOpen, setDropdownOpen, alert, setAlert } = useUI();
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const { productIdToDelete } = useProduct();

  useEffect(() => {
    if (!alert.message) return;

    const timer = setTimeout(() => {
      setAlert({ message: "", type: "" });
    }, 2500);

    return () => clearTimeout(timer);
  }, [alert, setAlert]);

  return (
    <>
      <a className="skip-link" href="#page-content">Skip to content</a>
      <header className="business-header">
        <Link to="/" className="brand" onClick={closeMenu}>{store.name}<span>HOME KITCHEN & PREORDERS</span></Link>
        <nav className="business-nav" aria-label="Main navigation">
          {publicLinks.map(([url,label])=><Link key={url} to={url} aria-current={location.pathname===url?'page':undefined}>{label}</Link>)}
        </nav>
        <div className="business-header-actions">
          {isAuthenticated && <Link to="/cart" className="basket-link" aria-label={`Basket, ${cart.reduce((n,i)=>n+i.quantity,0)} items`}><ShoppingBag size={19}/><span>{cart.reduce((n,i)=>n+i.quantity,0)}</span></Link>}
          {isAuthenticated===false && <button className="login-btn" onClick={()=>setShowLogin(true)}>Sign in</button>}
          {isAuthenticated && <div className="user-dropdown"><button className="user-icon" aria-label="Account menu" aria-expanded={dropdownOpen || false} onClick={()=>setDropdownOpen(!dropdownOpen)}><User size={20}/></button>{dropdownOpen && <div className="dropdown-content"><Link to="/orders" onClick={()=>setDropdownOpen(false)}>My orders</Link>{isAdmin && <Link to="/admin/planner" onClick={()=>setDropdownOpen(false)}>Kitchen dashboard</Link>}<button className="logout-btn" onClick={logout}>Sign out</button></div>}</div>}
          <button className="mobile-menu-toggle" aria-label={mobileOpen?'Close navigation':'Open navigation'} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={()=>setMobileOpen(!mobileOpen)}>{mobileOpen?<X size={23}/>:<Menu size={23}/>}</button>
        </div>
      </header>
      {mobileOpen && <nav className="mobile-navigation" id="mobile-navigation" aria-label="Mobile navigation">{publicLinks.map(([url,label])=><Link key={url} to={url} onClick={closeMenu} aria-current={location.pathname===url?'page':undefined}>{label}</Link>)}{isAuthenticated && <Link to="/orders" onClick={closeMenu}>My orders</Link>}{isAdmin && <Link to="/admin/planner" onClick={closeMenu}>Kitchen dashboard</Link>}</nav>}
      {isAdmin && <nav className="owner-nav" aria-label="Kitchen management">{[['planner','Planner'],['products','Menu management'],['inventory','Inventory'],['orders','Orders'],['reports','Sales'],['settings','Brand & settings'],['customers','Customers']].map(([path,label])=><Link key={path} to={'/admin/'+path}>{label}</Link>)}</nav>}

      <AnimatePresence>
        {showSignup && (
          <GrocerySignup />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogin && (
          <GroceryLogin />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {productIdToDelete && (
          <DeleteProduct />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {alert?.message && (
          <motion.div
            className={`alert ${alert.type}`}
            initial={{ opacity: 0, y:30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
          >
            <div>
              {alert.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div id="page-content" tabIndex="-1"><AnimatedRoutes/></div>
      {!ownerPage && <BusinessFooter/>}
    </>
  )
}

function AppProvider({ children }) {
  return (
    <UIProvider>
      <AuthProvider>
        <CartProvider>
          <ProductProvider>
            <OrderProvider>
              {children}
            </OrderProvider>
          </ProductProvider>
        </CartProvider>
      </AuthProvider>
    </UIProvider>
  )
}

export default function App() {

  return (
    <MotionConfig reducedMotion="user"><StorefrontProvider><AppProvider>
      <Router>
        <AppContent />
      </Router>
    </AppProvider></StorefrontProvider></MotionConfig>
  );
}
