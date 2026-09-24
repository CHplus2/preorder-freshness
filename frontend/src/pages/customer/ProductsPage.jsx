import axios from 'axios';
import {apiError} from '../../utils/apiError';
import InventoryFreshness from '../../components/InventoryFreshness';
import {PageMeta} from "../../components/BusinessLayout";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useUI } from "../../contexts/UIProvider";
import { useProduct } from "../../contexts/ProductProvider";
import { useCart } from "../../contexts/CartProvider";
import "./ProductsPage.css";

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { recommended, categories } = useProduct();
  const { fallback_img, formatPrice } = useUI();
  const { addToCart } = useCart();

  const scrollRef = useRef(null);
  const [scrollable,setScrollable]=useState({left:false,right:false});
  useEffect(()=>{
    const row=scrollRef.current;if(!row)return;
    const update=()=>setScrollable({left:row.scrollLeft>2,right:row.scrollLeft+row.clientWidth<row.scrollWidth-2});
    update();const observer=new ResizeObserver(update);observer.observe(row);
    row.addEventListener('scroll',update);
    return()=>{observer.disconnect();row.removeEventListener('scroll',update)};
  },[recommended]);
  const scrollRecommendations=direction=>scrollRef.current?.scrollBy({left:direction*300,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});


  const [listing,setListing]=useState({rows:[],count:0,next:false});
  const [page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const generation=useRef(0);
  useEffect(()=>{
    const c=new AbortController(),version=++generation.current;
    setLoading(true);setError('');
    const timer=setTimeout(()=>{
      axios.get('/api/menu/',{params:{page,search:searchTerm,category:selectedCategory},signal:c.signal})
        .then(({data})=>{if(version!==generation.current || c.signal.aborted)return;
          setListing(old=>({rows:page===1?data.results:[...old.rows,...data.results.filter(p=>!old.rows.some(o=>o.id===p.id))],count:data.count,next:!!data.next}));
        }).catch(e=>{if(!axios.isCancel(e) && version===generation.current)setError(apiError(e))})
        .finally(()=>{if(!c.signal.aborted && version===generation.current)setLoading(false)});
    },page===1?250:0);
    return()=>{clearTimeout(timer);c.abort()};
  },[searchTerm,selectedCategory,page,retry]);
  const changeFilter=(setter,value)=>{generation.current++;setter(value);setPage(1);setListing({rows:[],count:0,next:false});setLoading(true);setError('')};
  const filteredProducts=listing.rows;
  const showInventory=e=>{e.preventDefault();const section=document.getElementById('inventory-freshness');if(section){section.open=true;section.scrollIntoView({block:'start'});section.querySelector('summary')?.focus({preventScroll:true})}};

  return (
    <div className="products-page">
      <PageMeta title="The menu" description="Explore this kitchen’s current food menu, prices and preorder notice. Choose a favourite and schedule your delivery."/>
      <section className="menu-intro"><span className="dk-eyebrow">FIND YOUR NEXT FAVOURITE</span><h1>What sounds <em>good?</em></h1><p>Explore the current menu. Every item shows its price, advance notice and daily portion limit.</p></section>
      {/* Recommendation */}
      {recommended?.length > 0 && (
        <div className="recommended-section">
          <div className="recommendation-heading"><h2 className="section-title">Based on your activity</h2><div className="recommendation-controls">
            <button className="recommendation-arrow" aria-label="Previous recommendations" disabled={!scrollable.left} onClick={()=>scrollRecommendations(-1)}><ChevronLeft size={20} aria-hidden="true"/></button>
            <button className="recommendation-arrow" aria-label="Next recommendations" disabled={!scrollable.right} onClick={()=>scrollRecommendations(1)}><ChevronRight size={20} aria-hidden="true"/></button>
          </div></div>

          <div className="recommended-wrapper">

            <div className="recommended-row" ref={scrollRef}>
              {recommended.slice(0, 10).map((r) => (
                <div key={r.product_id} className="recommended-card">
                  <Link to={`/products/${r.product_id}`} className="product-link">
                    <div className="product-image-wrapper">
                      {r.product_img ? (
                        <img loading="lazy" decoding="async"
                          src={r.product_img} 
                          alt={r.product_name} 
                          className="product-image"
                          onError={(e) => {e.currentTarget.onerror=null;if(e.currentTarget.getAttribute("src")!==fallback_img)e.currentTarget.src=fallback_img}}
                        />
                      ) : (
                        <div className="image-placeholder">No Image</div>
                      )}
                    </div>
                    <div className="product-info">
                      <h3 className="product-title">{r.product_name}</h3>
                      <p className="product-price">{formatPrice(r.product_price)}</p>
                    </div>
                    {r.reasons?.length > 0 && (
                      <div className="recommend-badge">{r.reasons[0]}</div>
                    )}
                  </Link>
                  <button className="add-btn" onClick={() => addToCart(r.product_id)}>
                    Add to Cart
                  </button>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="browse-controls">
        <input
          type="text"
          aria-label="Search the menu" placeholder="Search meals, kuih, cakes…"
          value={searchTerm}
          onChange={(e) => changeFilter(setSearchTerm,e.target.value)}
          className="search-input"
        />
        <select
          value={selectedCategory}
          onChange={(e) => changeFilter(setSelectedCategory,e.target.value)}
          className="category-select" aria-label="Menu category"
        >
          <option value="">All Categories</option>
          {(Array.isArray(categories) ? categories : []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="menu-list-meta"><p role="status">{loading && !listing.rows.length?'Loading meals...':listing.count+' meals found'}</p><a href="#inventory-freshness" onClick={showInventory}>View ingredient storage records</a></div>
      {/* Products Grid */}
      <div className="products-container">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => (
            <div key={p.id} className="product-card">
              <Link to={`/products/${p.id}`} className="product-link">
                <div className="product-image-wrapper">
                  {p.image_url ? (
                    <img loading="lazy" decoding="async"
                      src={p.image_url} 
                      alt={p.name} 
                      className="product-image" 
                      onError={(e) => {e.currentTarget.onerror=null;if(e.currentTarget.getAttribute("src")!==fallback_img)e.currentTarget.src=fallback_img}}
                    />
                  ) : (
                    <div className="image-placeholder">No Image</div>
                  )}
                </div>
                <div className="product-info">
                  <h2 className="product-title">{p.name}</h2>
                  <p className="product-price">{formatPrice(p.price)}</p>
                  <small>{p.lead_hours}h advance notice · {p.daily_capacity} portions/day</small>
                </div>
              </Link>
              <button className="add-btn" onClick={() => addToCart(p.id)}>
                Add to Cart
              </button>
            </div>
          ))
        ) : !loading && !error ? (
          <p className="no-results">No menu items match. Try another category or check back when the kitchen updates its menu.</p>
        ) : null}
      </div>
      <div className="menu-load-more">
        {error && <p role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Try again</button></p>}
        {listing.rows.length>0 && <p role="status">Showing {listing.rows.length} of {listing.count} meals</p>}
        {listing.next && !error && <button className="dk-primary" disabled={loading} onClick={()=>{if(!loading){setLoading(true);setPage(n=>n+1)}}}>{loading?'Loading meals...':'Load more meals'}</button>}
      </div>
      <InventoryFreshness/>
    </div>
  );
}
