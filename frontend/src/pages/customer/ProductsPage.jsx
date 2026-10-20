import MenuKitchenHeader from '../../components/MenuKitchenHeader';
import {menuPage} from '../../utils/menuPresentation';
import MenuListingStatus from '../../components/MenuListingStatus';
import axios from 'axios';
import GuidedMenu from '../../components/GuidedMenu';
import {readApiError} from '../../utils/apiError';
import InventoryFreshness from '../../components/InventoryFreshness';
import {PageMeta} from "../../components/BusinessLayout";
import { useState, useRef, useEffect } from "react";
import { useProduct } from "../../contexts/ProductContext";
import {Search,X,CalendarDays} from 'lucide-react';
import {useStorefront} from '../../contexts/StorefrontContext';
import {Link} from 'react-router-dom';
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
          const parsed=menuPage(data);
          setListing(old=>({rows:page===1?parsed.rows:[...old.rows,...parsed.rows.filter(p=>!old.rows.some(o=>o.id===p.id))],count:parsed.count,next:parsed.next}));
        }).catch(e=>{if(!axios.isCancel(e) && version===generation.current)setError(readApiError(e))})
        .finally(()=>{if(!c.signal.aborted && version===generation.current)setLoading(false)});
    },page===1?250:0);
    return()=>{clearTimeout(timer);c.abort()};
  },[searchTerm,selectedCategory,page,retry]);
  const changeFilters=(search,category)=>{if(search===searchTerm && category===selectedCategory)return;generation.current++;setSearchTerm(search);setSelectedCategory(category);setPage(1);setListing({rows:[],count:0,next:false});setLoading(true);setError('')};
  const filteredProducts=listing.rows;

  return (
    <main className="products-page menu-storefront">
      <PageMeta title="The menu" description="Explore this kitchen’s current food menu, prices and preorder notice. Choose a favourite and schedule your delivery."/>
      <MenuKitchenHeader store={store}/>
      <section id="menu-browse" className="menu-toolbar" aria-label="Browse the menu">
        <div className="menu-search"><Search size={19} aria-hidden="true"/><input ref={searchInput} type="search" aria-label="Search the menu" placeholder="Find your next favourite…" value={searchTerm} onChange={e=>changeFilters(e.target.value,selectedCategory)}/>{searchTerm && <button type="button" aria-label="Clear menu search" onClick={()=>{changeFilters('',selectedCategory);searchInput.current?.focus();}}><X size={17}/></button>}</div>
        <button type="button" className="menu-date-shortcut" onClick={()=>{const finder=document.getElementById('menu-finder');if(finder){finder.open=true;finder.scrollIntoView({block:'start'});finder.querySelector('input')?.focus({preventScroll:true});}}}><CalendarDays size={17} aria-hidden="true"/>Find by delivery date</button>
        <div className="menu-category-tabs" role="group" aria-label="Menu categories"><button type="button" aria-pressed={selectedCategory===''} onClick={()=>changeFilters(searchTerm,'')}>All food</button>{(Array.isArray(categories)?categories:[]).map(c=><button type="button" key={c.id} aria-pressed={String(selectedCategory)===String(c.id)} onClick={()=>changeFilters(searchTerm,String(c.id))}>{c.name}</button>)}</div>
      </section>

      <div className="menu-list-meta"><MenuListingStatus loading={loading} error={error} count={listing.count} shown={listing.rows.length}/>{(searchTerm || selectedCategory) && <button type="button" className="menu-reset-filters" onClick={()=>changeFilters('','')}>Reset filters</button>}</div>
      {/* Products Grid */}
      <div className="products-container" aria-busy={loading}>
        {loading && !filteredProducts.length && Array.from({length:6},(_,i)=><div className="menu-skeleton" aria-hidden="true" key={i}><div/><span/><span/></div>)}
        {filteredProducts.length > 0 ? (
          filteredProducts.map(p=><MenuFoodCard key={p.id} product={p}/>)
        ) : !loading && !error ? (
          <div className="menu-empty-result"><h2>{searchTerm || selectedCategory?'No meals match these filters':'No menus available right now'}</h2><p>{searchTerm || selectedCategory?'Try another name or category.':'Check back soon or ask the kitchen about preorders.'}</p>{searchTerm || selectedCategory?<button type="button" onClick={()=>changeFilters('','')}>Show all food</button>:<Link to="/contact">Contact the kitchen</Link>}</div>
        ) : null}
      </div>
      <div className="menu-load-more">
        {error && <p role="alert">{error} <button onClick={()=>{setLoading(true);setError('');setRetry(n=>n+1)}}>Try again</button></p>}
        {listing.rows.length>0 && <p role="status">Showing {listing.rows.length} of {listing.count} meals</p>}
        {listing.next && !error && <button className="dk-primary" disabled={loading} onClick={()=>{if(!loading){setLoading(true);setPage(n=>n+1)}}}>{loading?'Loading meals...':'Load more meals'}</button>}
      </div>
      <GuidedMenu/>
      <InventoryFreshness/>
      <BasketBar/>
    </main>
  );
}
