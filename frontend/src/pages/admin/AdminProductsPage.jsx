import MenuEditor from '../../components/MenuEditor';
import {unitLabel} from '../../utils/sellingDetails';
import MenuPhoto from '../../components/MenuPhoto';
import {useSearchParams} from 'react-router-dom';
import './MenuSellingStatus.css';
import { useEffect, useState } from "react";
import { useUI } from "../../contexts/UIContext";
import { useProduct } from "../../contexts/ProductContext";


export default function AdminProductsPage() {
  const [reviewParams]=useSearchParams();
  const review=reviewParams.get('review');
  const reviewTitles={recipes:'Menu ingredients',preparation:'Preparation steps',costs:'Menu costs'};
  const [statusFilter,setStatusFilter]=useState('current');
  const [missingStepsOnly,setMissingStepsOnly]=useState(true);
  const [statusBusy,setStatusBusy]=useState(false);
  const [statusMessage,setStatusMessage]=useState('');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newProduct, setNewProduct] = useState(false);
  const [updatedProduct, setUpdatedProduct] = useState(false);
  const editingProductId=updatedProduct?.id;
  useEffect(()=>{
    if(!editingProductId || !['recipes','preparation','costs'].includes(review))return;
    const target=document.querySelector(review==='preparation'?'.preparation-editor':review==='costs'?'[data-review-cost]':'.recipe-editor');
    if(target){target.scrollIntoView({block:'start'});target.querySelector('input,select,button')?.focus({preventScroll:true});}
  },[editingProductId,review]);

  const { fallback_img, setAlert } = useUI();
  const { categories, products, fetchProducts, updateProduct, setProductIdToDelete } = useProduct();

  useEffect(()=>{fetchProducts()},[fetchProducts]);
  const emptyForm = {
    name: "",
    price: "",
    stock: "",
    description: "",
    category: "",
    image_url: "",
  };

  const changeStatus=async(product,selling_status)=>{
    if(statusBusy)return;
    setStatusBusy(true);setStatusMessage('');
    try{if(await updateProduct({id:product.id,selling_status})){await fetchProducts();setStatusMessage(`${product.name}: ${selling_status==='active'?'accepting new orders':selling_status}. Existing orders are unchanged.`);}}finally{setStatusBusy(false);}
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? p.category === Number(selectedCategory) : true;
    const matchesPreparation=review!=='preparation' || !missingStepsOnly || (p.selling_status==='active' && !p.preparation_tasks?.length);
    return matchesSearch && matchesCategory && matchesPreparation && (statusFilter==='all' || (statusFilter==='current'?p.selling_status!=='archived':p.selling_status===statusFilter));
  });

  return (
    <div className="admin-products-container">
      <div className="admin-header">
        <h1>Menu management</h1>
        <button className="add-product-btn" onClick={() => {setAlert({message:'',type:''});setNewProduct(emptyForm);}}>
          Create menu
        </button>
      </div>

{reviewTitles[review] && <p className="menu-state-feedback" role="status"><strong>Review: {reviewTitles[review]}</strong><br/>Choose a menu below. Its editor will open at the relevant section.</p>}
{review==='preparation' && <label><input type="checkbox" checked={missingStepsOnly} onChange={e=>setMissingStepsOnly(e.target.checked)}/> Show only active menus missing preparation steps</label>}
<p className="menu-state-intro">Pause a menu to stop new orders. Archive it to remove it from your current menu list. Existing orders keep their recipes and delivery plans.</p>
      {statusMessage && <p className="menu-state-feedback" role="status">{statusMessage}</p>}
      {/* Search & Filter */}
      <div className="admin-browse-controls">
        <input
          type="text"
          className="search-input" aria-label="Search menus"
          placeholder="Search by product name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="category-select" aria-label="Filter menu category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
<select aria-label="Filter selling status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="current">Current menus</option><option value="active">Accepting orders</option><option value="paused">Paused</option><option value="archived">Archived</option><option value="all">All menus</option></select>
      </div>
    
      {/* Product List */}
      <div className="admin-table-scroll responsive-records"><table className="admin-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>Price</th>
            <th>Available units</th>
            <th>Category</th>
            <th>Preparation</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.length > 0 ? (
            filteredProducts.map((p) => (
              <tr key={p.id}>
                <td data-label="Image">
                  {p.image_url ? (
                    <MenuPhoto sizes="60px" loading="lazy"
                      src={p.image_url} 
                      alt={p.name} 
                      className="table-img" 
                      onError={(e) => (e.target.src = fallback_img)}
                    />
                  ) : (
                    <div className="image-placeholder">No Image</div>
                  )}
                </td>
                <td data-label="Name"><strong>{p.name}</strong><span className="menu-state-label">{p.selling_status==='archived'?'Archived':p.selling_status==='paused'?'Paused':'Accepting orders'}</span></td>
              <td data-label="Price">RM {p.price} / {unitLabel(p.selling_details)}</td>
              <td data-label="Available units">{p.stock}</td>
              <td data-label="Category">{p.category_name}</td>
              <td data-label="Preparation"><span className="status-badge">{p.preparation_tasks?.length ? `${p.preparation_tasks.length} steps` : "Needs setup"}</span></td>
              <td data-label="Actions">
                <div className="menu-state-actions">
                  <button disabled={statusBusy} onClick={() => {setAlert({message:'',type:''});setUpdatedProduct({ ...p });}}>{reviewTitles[review]?`Edit ${reviewTitles[review].toLowerCase()}`:'Edit & steps'}</button>
                  <button className="menu-delete-action" disabled={statusBusy} onClick={()=>{setAlert({message:'',type:''});setProductIdToDelete(p.id);}}>Delete</button>
                  {p.selling_status==='archived'?<button disabled={statusBusy} onClick={()=>changeStatus(p,'paused')}>Restore as paused</button>:<>
                    <button disabled={statusBusy} onClick={()=>changeStatus(p,p.selling_status==='active'?'paused':'active')}>{p.selling_status==='active'?'Pause orders':'Resume orders'}</button>
                    <button disabled={statusBusy} onClick={()=>changeStatus(p,'archived')}>Archive</button>
                  </>}
                </div>
              </td>
            </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7">{review==='preparation' && missingStepsOnly?'No active menus missing preparation steps match these filters. Uncheck the option above to review existing steps.':'No products found.'}</td>
            </tr>
          )}

        </tbody>
      </table></div>

      {updatedProduct && <MenuEditor key={'edit-'+updatedProduct.id} value={updatedProduct} onChange={setUpdatedProduct} onDismiss={()=>setUpdatedProduct(null)}/>}
      {newProduct && <MenuEditor key="create" value={newProduct} onChange={setNewProduct} onDismiss={()=>setNewProduct(null)}/>}
    </div>
  );
}
