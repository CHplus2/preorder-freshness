import DialogFeedback from '../../components/DialogFeedback';
import ModalDialog from '../../components/ModalDialog';
import MenuPhotoField from "../../components/MenuPhotoField";
import RecipeEditor from "../../components/RecipeEditor";
import { useEffect, useState } from "react";
import { useUI } from "../../contexts/UIProvider";
import { useProduct } from "../../contexts/ProductProvider";


export default function AdminProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newProduct, setNewProduct] = useState(false);
  const [updatedProduct, setUpdatedProduct] = useState(false);
  const [loading, setLoading] = useState(false);
  const { fallback_img, setAlert } = useUI();
  const { categories, products, fetchProducts, setProductIdToDelete, addProduct, updateProduct } = useProduct();

  useEffect(()=>{fetchProducts()},[fetchProducts]);
  const emptyForm = {
    name: "",
    price: "",
    stock: "",
    description: "",
    category: "",
    image_url: "",
  };

  useEffect(() => {
    if (newProduct || updatedProduct) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    }
  }, [newProduct, updatedProduct]);

  const validateInput = (product) => {
    if (!product.name || !product.price || !product.category) {
      setAlert({message:"Please fill all required fields",type:"error"});
      return false;
    }
    return true;
  };

  const handleAddProduct = async () => {
    if (!validateInput(newProduct)) {
      return;
    }

    setLoading(true);

    const saved = await addProduct(newProduct);
    if (!saved) { setLoading(false); return; }
    
    setNewProduct(null);
    setLoading(false);
  };

  const handleUpdateProduct = async () => {
    if (!validateInput(updatedProduct)) {
      return;
    }

    setLoading(true); 

    const saved = await updateProduct(updatedProduct);
    if (!saved) { setLoading(false); return; }

    setUpdatedProduct(null);
    setLoading(false);
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? p.category === Number(selectedCategory) : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="admin-products-container">
      <div className="admin-header">
        <h1>Menu management</h1>
        <button className="add-product-btn" onClick={() => setNewProduct(emptyForm)}>
          Create menu
        </button>
      </div>

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
      </div>
    
      {/* Product List */}
      <div className="admin-table-scroll responsive-records"><table className="admin-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>Price</th>
            <th>Available portions</th>
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
                    <img 
                      src={p.image_url} 
                      alt={p.name} 
                      className="table-img" 
                      onError={(e) => (e.target.src = fallback_img)}
                    />
                  ) : (
                    <div className="image-placeholder">No Image</div>
                  )}
                </td>
                <td data-label="Name">{p.name}</td>
              <td data-label="Price">RM {p.price}</td>
              <td data-label="Available portions">{p.stock}</td>
              <td data-label="Category">{p.category_name}</td>
              <td data-label="Preparation"><span className="status-badge">{p.preparation_tasks?.length ? `${p.preparation_tasks.length} steps` : "Needs setup"}</span></td>
              <td data-label="Actions">
                <button onClick={() => setUpdatedProduct({ ...p })}>Edit & steps</button>
                <button
                  className="danger"
                  onClick={() => setProductIdToDelete(p.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7">No products found.</td>
            </tr>
          )}

        </tbody>
      </table></div>

      {/* Edit Product Modal */}
      {updatedProduct && (
      <ModalDialog label="Update Product" onDismiss={() => setUpdatedProduct(null)}>
<div className="modal-overlay" onClick={() => setUpdatedProduct(null)}>
        <div className="modal-content form-modal" onClick={(e) => e.stopPropagation()}>
          <h2>Update Product</h2>
          <DialogFeedback/>

          <label htmlFor="adminproductspage-field-1">Product Name</label>
          <input id="adminproductspage-field-1"
            value={updatedProduct.name}
            onChange={(e) => setUpdatedProduct({ ...updatedProduct, name: e.target.value })}
          />
          <label htmlFor="adminproductspage-field-2">Price</label>
          <input id="adminproductspage-field-2"
            type="number"
            value={updatedProduct.price}
            onChange={(e) => setUpdatedProduct({ ...updatedProduct, price: e.target.value })}
          />

          <RecipeEditor value={updatedProduct} onChange={setUpdatedProduct}/>
          <label htmlFor="adminproductspage-field-3">Description</label>
          <textarea id="adminproductspage-field-3"
            value={updatedProduct.description}
            onChange={(e) => setUpdatedProduct({ ...updatedProduct, description: e.target.value })}
          />
          <label htmlFor="adminproductspage-field-4">Category</label>
          <select id="adminproductspage-field-4"
            value={updatedProduct.category || ""}
            onChange={(e) => setUpdatedProduct({ ...updatedProduct, category: Number(e.target.value) })}
          >
            <option value="">-- Select Category --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <MenuPhotoField value={updatedProduct.image_url || ""} onChange={url => setUpdatedProduct({ ...updatedProduct, image_url: url })} />

          <div className="modal-actions">  
            <button onClick={handleUpdateProduct} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setUpdatedProduct(null)}>Cancel</button>
          </div>
        </div>
      </div>
</ModalDialog>
      )}

      {/* Add Product Modal */}
      {newProduct && (
      <ModalDialog label="Create menu" onDismiss={() => setNewProduct(null)}>
<div className="modal-overlay" onClick={() => setNewProduct(null)}>
        <div className="modal-content form-modal" onClick={(e) => e.stopPropagation()}>
          <h2>Create menu</h2>
          <DialogFeedback/>

          <label htmlFor="adminproductspage-field-5">Name</label>
          <input id="adminproductspage-field-5"
            value={newProduct.name}
            onChange={(e) =>
              setNewProduct({ ...newProduct, name: e.target.value })
            }
          />

          <label htmlFor="adminproductspage-field-6">Price</label>
          <input id="adminproductspage-field-6"
            type="number"
            value={newProduct.price}
            onChange={(e) =>
              setNewProduct({ ...newProduct, price: e.target.value })
            }
          />



          <RecipeEditor value={newProduct} onChange={setNewProduct}/>
          <label htmlFor="adminproductspage-field-7">Description</label>
          <textarea id="adminproductspage-field-7"
            value={newProduct.description}
            onChange={(e) =>
              setNewProduct({ ...newProduct, description: e.target.value })
            }
          />

          <label htmlFor="adminproductspage-field-8">Category</label>
          <select id="adminproductspage-field-8"
            value={newProduct.category}
            onChange={(e) =>
              setNewProduct({ ...newProduct, category: Number(e.target.value) })
            }
          >
            <option value="">-- Select Category --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <MenuPhotoField value={newProduct.image_url || ""} onChange={url => setNewProduct({ ...newProduct, image_url: url })} />

          <div className="modal-actions">
            <button onClick={handleAddProduct} disabled={loading}>
              {loading ? "Adding..." : "Add"}
            </button>
            <button onClick={() => setNewProduct(null)}>Cancel</button>
          </div>
        </div>
      </div>
</ModalDialog>
      )}
    </div>
  );
}
