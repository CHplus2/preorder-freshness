import MenuReviews from "../../components/MenuReviews";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useUI } from "../../contexts/UIProvider"
import { useCart } from "../../contexts/CartProvider";
import axios from "axios";
import "./ProductDetailPage.css";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const { formatPrice } = useUI();
  const { addToCart } = useCart();

  useEffect(() => {
    axios.get(`/api/products/${id}/`)
      .then(res => setProduct(res.data));
  }, [id]);

  if (!product) return <p>Loading...</p>;

  return (
    <div className="product-detail-container">
      
      {/* LEFT: IMAGE */}
      <div className="product-detail-left">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="product-detail-image"
          />
        )}
      </div>

      {/* RIGHT: INFO */}
      <div className="product-detail-right">
        <h1 className="detail-title">{product.name}</h1>

        {/*<div className="ai-summary">
          {product.ai_summary}
        </div>*/}

        <p className="detail-description">{product.description}</p>

        <div className="price">
          {formatPrice(product.price)}
        </div>

        <div className="meta">
          <span>{product.lead_hours} hours advance notice</span>
          <span>{product.freshness}</span>
          <span>Category: {product.category_name}</span>
        </div>

        <button
          onClick={() => addToCart(product.id)}
          className="add-btn"
        >
          Add to Cart
        </button>
        <p>Ingredient dates describe current stock; future meals may use new batches. Contact the owner about allergies.</p>
        {product.social_url && <a href={product.social_url} target="_blank" rel="noreferrer">See this food on social media ↗</a>}
        <MenuReviews id={id}/>
      </div>

    </div>
  );
}
