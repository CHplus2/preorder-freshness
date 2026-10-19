import MenuListingStatus from '../../components/MenuListingStatus';
import axios from 'axios';
import GuidedMenu from '../../components/GuidedMenu';
import {apiError} from '../../utils/apiError';
import InventoryFreshness from '../../components/InventoryFreshness';
import {PageMeta} from "../../components/BusinessLayout";
import { useState, useRef, useEffect } from "react";
import { useProduct } from "../../contexts/ProductContext";
import {Search,X,CalendarDays,ArrowDown,MapPin,UtensilsCrossed} from 'lucide-react';
import {useStorefront} from '../../contexts/StorefrontContext';
import OrderJourney from '../../components/OrderJourney';
import BasketBar from '../../components/BasketBar';
import MenuFoodCard from '../../components/MenuFoodCard';
import "./ProductsPage.css";

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { categories } = useProduct();
  const {store}=useStorefront();
  const searchInput=useRef(null);

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
    <main className="products-page menu-storefront">
      <PageMeta title="The menu" description="Explore this kitchen’s current food menu, prices and preorder notice. Choose a favourite and schedule your delivery."/>
      <OrderJourney current="menu"/>
      <section className="menu-welcome" aria-labelledby="menu-welcome-title">
        <div className="menu-welcome-copy"><span className="menu-kitchen-label"><UtensilsCrossed size={15} aria-hidden="true"/>{store.name} · The menu</span><h1 id="menu-welcome-title">Good food.<br/><em>Better planned.</em></h1><p>Find your favourites, build a basket, and choose a delivery time that works for your plans.</p><div className="menu-welcome-links"><a href="#menu-browse">Explore the menu <ArrowDown size={16} aria-hidden="true"/></a><span><MapPin size={14} aria-hidden="true"/>{store.service_area || 'Home kitchen & preorders'}</span></div></div>
        <div className="menu-welcome-art" aria-hidden="true"><span className="menu-art-ring"/><img className="menu-hero-meal" src={`${import.meta.env.BASE_URL}menu-images/nasi-lemak.jpg`} alt=""/><div className="menu-hero-bake"><img src={`${import.meta.env.BASE_URL}menu-images/walnut-brownies.jpg`} alt=""/><span>A little something sweet</span></div><span className="menu-art-note">Made for<br/><em>your plans.</em></span></div>
      </section>
      <GuidedMenu/>
      <section id="menu-browse" className="menu-toolbar" aria-label="Browse the menu">
        <div className="menu-search"><Search size={19} aria-hidden="true"/><input ref={searchInput} type="search" aria-label="Search the menu" placeholder="Find your next favourite…" value={searchTerm} onChange={e=>changeFilter(setSearchTerm,e.target.value)}/>{searchTerm && <button type="button" aria-label="Clear menu search" onClick={()=>{changeFilter(setSearchTerm,'');searchInput.current?.focus();}}><X size={17}/></button>}</div>
        <button type="button" className="menu-date-shortcut" onClick={()=>{const finder=document.getElementById('menu-finder');if(finder){finder.open=true;finder.scrollIntoView({block:'start'});finder.querySelector('input')?.focus({preventScroll:true});}}}><CalendarDays size={17} aria-hidden="true"/>Find by delivery date</button>
        <div className="menu-category-tabs" role="group" aria-label="Menu categories"><button type="button" aria-pressed={selectedCategory===''} onClick={()=>changeFilter(setSelectedCategory,'')}>All food</button>{(Array.isArray(categories)?categories:[]).map(c=><button type="button" key={c.id} aria-pressed={String(selectedCategory)===String(c.id)} onClick={()=>changeFilter(setSelectedCategory,String(c.id))}>{c.name}</button>)}</div>
      </section>

      <div className="menu-list-meta"><MenuListingStatus loading={loading} error={error} count={listing.count} shown={listing.rows.length}/><a href="#inventory-freshness" onClick={showInventory}>View ingredient storage records</a></div>
      {/* Products Grid */}
      <div className="products-container" aria-busy={loading}>
        {loading && !filteredProducts.length && Array.from({length:6},(_,i)=><div className="menu-skeleton" aria-hidden="true" key={i}><div/><span/><span/></div>)}
        {filteredProducts.length > 0 ? (
          filteredProducts.map(p=><MenuFoodCard key={p.id} product={p}/>)
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
      <BasketBar/>
    </main>
  );
}
