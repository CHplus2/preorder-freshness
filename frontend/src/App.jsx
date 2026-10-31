import PageState from './components/PageState';
import {publicNavigation,kitchenNavigation,isCurrentSection,pageMetadata} from './utils/siteNavigation';
import AppNotification from './components/AppNotification';
import PageLoading from "./components/PageLoading";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { User, Menu, X, ShoppingBag } from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { useUI } from "./contexts/UIContext";
import { useProduct } from "./contexts/ProductContext";
import AuthProvider from "./contexts/AuthProvider";
import UIProvider from "./contexts/UIProvider";
import ProductProvider from "./contexts/ProductProvider";
import { useCart } from "./contexts/CartContext";
import CartProvider from "./contexts/CartProvider";
import OrderProvider from "./contexts/OrderProvider";
import RequireAuth from "./hoc/RequireAuth";
import GroceryLogin from "./components/LoginModal/GroceryLogin";
import GrocerySignup from "./components/SignupModal/GrocerySignup";
import DeleteProduct from "./components/DeleteProductModal/DeleteProduct";
const ProductsPage=lazy(()=>import("./pages/customer/ProductsPage"));
const ProductsDetailPage=lazy(()=>import("./pages/customer/ProductDetailPage"));
const CartPage=lazy(()=>import("./pages/customer/CartPage"));
const OrdersPage=lazy(()=>import("./pages/customer/OrdersPage"));
const AccountPage=lazy(()=>import("./pages/customer/AccountPage"));
const CheckoutPage=lazy(()=>import("./pages/customer/CheckoutPage"));
const RecoveryPage=lazy(()=>import('./pages/customer/RecoveryPage'));
const ConfirmEmailPage=lazy(()=>import('./pages/customer/ConfirmEmailPage'));
import './fyp.css';
const PaymentPage=lazy(()=>import("./pages/customer/PaymentPage"));
const AdminProductsPage=lazy(()=>import("./pages/admin/AdminProductsPage"));
const PackagingPage=lazy(()=>import('./pages/admin/PackagingPage'));
const AdminInventoryPage=lazy(()=>import("./pages/admin/AdminInventoryPage"));
const AdminOrdersPage=lazy(()=>import("./pages/admin/AdminOrdersPage"));
const AdminReportsPage=lazy(()=>import("./pages/admin/AdminReportsPage"));
const AdminCustomersPage=lazy(()=>import("./pages/admin/AdminCustomersPage"));
const StoreSettingsPage=lazy(()=>import("./pages/admin/StoreSettingsPage"));
const PredictiveDashboard=lazy(()=>import("./features/predictive/PredictiveDashboard"));
const PlannerPage=lazy(()=>import("./pages/admin/PlannerPage"));
import "./App.css";
import "./dapur.css";
import "./business.css";
import "./admin.css";
import "./textLinks.css";
import "./feedback.css";
import StorefrontProvider from './contexts/StorefrontProvider';
import {useStorefront} from './contexts/StorefrontContext';
import {HomePage,StoryPage,HowItWorksPage,ContactPage} from './pages/customer/BusinessPages';
import {BusinessFooter,PageMeta} from './components/BusinessLayout';
const EscrowOrderPayment=lazy(()=>import('./pages/customer/EscrowOrderPayment'));
const EscrowDemoPage=lazy(()=>import('./pages/customer/EscrowDemoPage'));

function AnimatedRoutes() {
  const location = useLocation();

  const page_motion = location.pathname.startsWith('/admin/') ? {} : {
    initial: { opacity: 0, scale: 0.98, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: -10 },
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {['forecast', 'inventory', 'decisions'].map(view => (
          <Route key={view} path={`/admin/ai/${view}`} element={
            <RequireAuth message="Admin access required"><PredictiveDashboard view={view}/></RequireAuth>
          }/>
        ))}
        <Route path="/account" element={<RequireAuth><AccountPage/></RequireAuth>}/>
        <Route path="/recover" element={<RecoveryPage/>}/>
        <Route path="/confirm-email" element={<ConfirmEmailPage/>}/>
        <Route path="/payment/escrow" element={<RequireAuth><Suspense fallback={<PageLoading label="Loading order escrow…"/>}><EscrowOrderPayment/></Suspense></RequireAuth>}/>
        <Route path="/escrow-demo" element={<Suspense fallback={<PageLoading label="Loading escrow payment…"/>}><EscrowDemoPage/></Suspense>}/>
        <Route path="/story" element={<StoryPage/>}/>
        <Route path="/how-it-works" element={<HowItWorksPage/>}/>
        <Route path="/contact" element={<ContactPage/>}/>
        <Route path="/menu" element={<ProductsPage/>}/>
        <Route path="*" element={<PageState title="This page isn’t on the menu." description="The link may have changed. You can browse the menu or return to your saved orders."><Link to="/menu">Explore the menu</Link><Link to="/orders">My orders</Link></PageState>}/>
        <Route path="/admin/packaging" element={<RequireAuth message="Admin access required"><PackagingPage/></RequireAuth>}/>
        <Route path="/admin/settings" element={<RequireAuth message="Admin access required"><StoreSettingsPage/></RequireAuth>}/>
        <Route path="/admin/planner" element={<RequireAuth message="Admin access required"><PlannerPage key={location.search}/></RequireAuth>}/>
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
  const {cart,cartLoading,cartUpdating,cartError}=useCart();
  const location=useLocation();
  const [mobileOpen,setMobileOpen]=useState(false);
  const mobileToggle=useRef(null),mobileNavigation=useRef(null),accountMenu=useRef(null),accountToggle=useRef(null);
  const ownerPage=location.pathname.startsWith('/admin/');
  const publicLinks=publicNavigation,ownerLinks=kitchenNavigation;
  const metadata=pageMetadata(location.pathname);
  const basketCount=cart.reduce((n,item)=>n+item.quantity,0);
  const basketStatus=cartLoading || cartUpdating?'updating':cartError?'unavailable':`${basketCount} ${basketCount===1?'item':'items'}`;
  const kitchenNav=useRef(null),previousPath=useRef(location.pathname);
  const navigation=ownerPage?ownerLinks:publicLinks;
  const closeMenu=()=>setMobileOpen(false);
  useEffect(()=>{
    window.scrollTo({top:0,behavior:'instant'});
    if(previousPath.current!==location.pathname && !document.querySelector('dialog[open]'))document.getElementById('page-content')?.focus({preventScroll:true});
    previousPath.current=location.pathname;
  },[location.pathname]);
  useEffect(()=>{
    const nav=kitchenNav.current;
    if(!nav)return;
    const reveal=()=>{
      const current=nav.querySelector('[aria-current="page"]');
      if(current && nav.scrollWidth>nav.clientWidth){const box=current.getBoundingClientRect(),container=nav.getBoundingClientRect();nav.scrollLeft+=box.left-container.left-(container.width-box.width)/2;}
    };
    reveal();const observer=new ResizeObserver(reveal);observer.observe(nav);
    return()=>observer.disconnect();
  },[location.pathname]);
  const { showLogin, setShowLogin, showSignup, dropdownOpen, setDropdownOpen, alert, setAlert } = useUI();
  const dismissNotification=useCallback(()=>setAlert({message:'',type:''}),[setAlert]);
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const { productIdToDelete } = useProduct();

  useEffect(()=>{
    const dismiss=event=>{
      if(event.key!=='Escape' || event.defaultPrevented || event.target.closest?.('dialog,[role="dialog"]'))return;
      if(dropdownOpen){setDropdownOpen(false);accountToggle.current?.focus();}
      else if(mobileOpen){setMobileOpen(false);mobileToggle.current?.focus();}
    };
    const outside=event=>{
      if(dropdownOpen && !accountMenu.current?.contains(event.target))setDropdownOpen(false);
      if(mobileOpen && !mobileToggle.current?.contains(event.target) && !mobileNavigation.current?.contains(event.target))setMobileOpen(false);
    };
    document.addEventListener('keydown',dismiss);document.addEventListener('pointerdown',outside);
    return()=>{document.removeEventListener('keydown',dismiss);document.removeEventListener('pointerdown',outside);};
  },[mobileOpen,dropdownOpen,setDropdownOpen]);


  return (
    <>
      <PageMeta {...metadata}/>
      <a className="skip-link" href="#page-content">Skip to content</a>
      <header className={`business-header ${ownerPage?"owner-header":""}`}>
        <Link to="/" className="brand" onClick={closeMenu}>{store.name}<span>HOME KITCHEN & PREORDERS</span></Link>
        {!ownerPage && <nav className="business-nav" aria-label="Main navigation">
          {navigation.map(([url,label])=><Link key={url} to={url} aria-current={isCurrentSection(location.pathname,url)?'page':undefined}>{label}</Link>)}
        </nav>}
        <div className="business-header-actions">
          {isAuthenticated && !ownerPage && <Link to="/cart" className="basket-link" aria-label={`Basket, ${basketStatus}`}><ShoppingBag size={19}/><span aria-hidden="true">{cartLoading || cartUpdating?'…':cartError?'!':basketCount}</span></Link>}
          {isAuthenticated===false && <button className="login-btn" onClick={()=>setShowLogin(true)}>Sign in</button>}
          {isAuthenticated && <div className="user-dropdown" ref={accountMenu}><button ref={accountToggle} className="user-icon" aria-label="Account menu" aria-expanded={dropdownOpen || false} aria-controls="account-navigation" onClick={()=>{setMobileOpen(false);setDropdownOpen(!dropdownOpen);}}><User size={20}/></button>{dropdownOpen && <div className="dropdown-content" id="account-navigation"><Link to="/account" onClick={()=>setDropdownOpen(false)}>Account settings</Link><Link to="/orders" onClick={()=>setDropdownOpen(false)}>My orders</Link>{isAdmin && <Link to="/admin/planner" onClick={()=>setDropdownOpen(false)}>Kitchen dashboard</Link>}<button className="logout-btn" onClick={logout}>Sign out</button></div>}</div>}
          {!ownerPage && <button ref={mobileToggle} className="mobile-menu-toggle" aria-label={mobileOpen?'Close navigation':'Open navigation'} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={()=>{setDropdownOpen(false);setMobileOpen(!mobileOpen);}}>{mobileOpen?<X size={23}/>:<Menu size={23}/>}</button>}
        </div>
      </header>
      {mobileOpen && !ownerPage && <nav ref={mobileNavigation} className="mobile-navigation" id="mobile-navigation" aria-label="Mobile navigation">{navigation.map(([url,label])=><Link key={url} to={url} onClick={closeMenu} aria-current={isCurrentSection(location.pathname,url)?'page':undefined}>{label}</Link>)}{isAuthenticated && <Link to="/orders" onClick={closeMenu}>My orders</Link>}{isAdmin && <Link to="/admin/planner" onClick={closeMenu}>Kitchen dashboard</Link>}</nav>}

      <AnimatePresence>
        {showSignup && (
          <GrocerySignup />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogin && !showSignup && (
          <GroceryLogin />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {productIdToDelete && (
          <DeleteProduct />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {alert?.message && <AppNotification key={alert.id ?? alert.message+alert.type} alert={alert} onDismiss={dismissNotification}/>}

      </AnimatePresence>

      <div className={ownerPage?'admin-shell':''} onInvalidCapture={e=>{let node=e.target.parentElement;while(node){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement}}}>{ownerPage && <aside className="admin-sidebar"><span className="admin-sidebar-label">KITCHEN WORKSPACE</span><nav ref={kitchenNav} aria-label="Kitchen management">{ownerLinks.map(([url,label])=><Link key={url} to={url} aria-current={isCurrentSection(location.pathname,url)?'page':undefined}>{label}</Link>)}</nav></aside>}<div id="page-content" className={ownerPage?'admin-content':''} tabIndex="-1"><RouteErrorBoundary route={location.pathname}><Suspense fallback={<PageLoading />}><AnimatedRoutes/></Suspense></RouteErrorBoundary></div></div>
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
