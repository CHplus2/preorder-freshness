import MenuReviews from "../../components/MenuReviews";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageLoading from "../../components/PageLoading";
import { apiError } from "../../utils/apiError";
import { useUI } from "../../contexts/UIProvider"
import { useCart } from "../../contexts/CartProvider";
import axios from "axios";
import "./ProductDetailPage.css";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const { formatPrice } = useUI();
  const { addToCart } = useCart();

  useEffect(() => {
    const controller = new AbortController();
    axios.get(`/api/products/${id}/`, { signal: controller.signal })
      .then(res => { if (!controller.signal.aborted) { setProduct({ id, attempt, data: res.data }); setFailure(null); } })
      .catch(err => { if (!controller.signal.aborted) setFailure({ id, attempt, message: err.response?.status === 404 ? 'This menu item is no longer available.' : apiError(err, 'Unable to load this meal. Please try again.') }); });
    return () => controller.abort();
  }, [id, attempt]);

  if (failure?.id === id && failure.attempt === attempt) return <section className="product-detail-container"><div><h1>Meal unavailable</h1><p role="alert">{failure.message}</p><div className="detail-recovery"><button onClick={() => setAttempt(n => n + 1)}>Try again</button><Link to="/menu">Back to menu</Link></div></div></section>;
  if (product?.id !== id || product.attempt !== attempt) return <PageLoading label="Loading meal..." />;
  return <ProductContent product={product.data} id={id} formatPrice={formatPrice} addToCart={addToCart}/>;
}

function ProductContent({product, id, formatPrice, addToCart}) {
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
