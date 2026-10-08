import MenuListingStatus from '../../components/MenuListingStatus';
import axios from 'axios';
import GuidedMenu from '../../components/GuidedMenu';
import {apiError} from '../../utils/apiError';
import InventoryFreshness from '../../components/InventoryFreshness';
import {PageMeta} from "../../components/BusinessLayout";
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useUI } from "../../contexts/UIContext";
import { useProduct } from "../../contexts/ProductContext";
import { useCart } from "../../contexts/CartContext";
import "./ProductsPage.css";

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { categories } = useProduct();
  const { fallback_img, formatPrice } = useUI();
  const { addToCart } = useCart();

  const [listing,setListing]=useState({rows:[],count:0,next:false});
  const [page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const generation=useRef(0);
  useEffect(()=>{
    const c=new AbortController(),version=++generation.current;
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
      <p className="menu-availability-note">Need a particular delivery date? Use the menu finder below, then check delivery times for your combined basket before checkout. <Link to="/cart">Check basket times</Link></p>
      <GuidedMenu/>

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

      <div className="menu-list-meta"><MenuListingStatus loading={loading} error={error} count={listing.count} shown={listing.rows.length}/><a href="#inventory-freshness" onClick={showInventory}>View ingredient storage records</a></div>
      {/* Products Grid */}
      <div className="products-container" aria-busy={loading}>
        {loading && !filteredProducts.length && Array.from({length:6},(_,i)=><div className="menu-skeleton" aria-hidden="true" key={i}><div/><span/><span/></div>)}
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
                    <div className="image-placeholder">Photo coming soon</div>
                  )}
                </div>
                <div className="product-info">
                  <h2 className="product-title">{p.name}</h2>
                  <p className="product-price">{formatPrice(p.price)}</p>
                  <small>{p.lead_hours}h advance notice · {p.daily_capacity} portions/day</small>
                </div>
              </Link>
              {p.social_url && <a className="menu-video-link" href={p.social_url} target="_blank" rel="noreferrer">Watch this food being made <span aria-hidden="true">↗</span></a>}
              <button className="add-btn" onClick={() => addToCart(p.id)}>
                Add to basket
              </button>
            </div>
          ))
        ) : !loading && !error ? (
          <p className="no-results">No menu items match. Try another category or check back when the kitchen updates its menu.</p>
        ) : null}
      </div>
      <div className="menu-load-more">
        {error && <p role="alert">{error} <button onClick={()=>{setLoading(true);setError('');setRetry(n=>n+1)}}>Try again</button></p>}
        {listing.rows.length>0 && <p role="status">Showing {listing.rows.length} of {listing.count} meals</p>}
        {listing.next && !error && <button className="dk-primary" disabled={loading} onClick={()=>{if(!loading){setLoading(true);setPage(n=>n+1)}}}>{loading?'Loading meals...':'Load more meals'}</button>}
      </div>
      <InventoryFreshness/>
    </div>
  );
}
