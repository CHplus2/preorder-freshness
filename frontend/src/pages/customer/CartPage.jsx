import {deliveryDaysText} from '../../utils/deliveryDays';
import { useNavigate } from "react-router-dom";
import { useUI } from "../../contexts/UIContext";
import { useCart } from "../../contexts/CartContext";
import "./CartPage.css";

export default function CartPage() { 
  const { formatPrice } = useUI();
  const { cart, cartLoading, cartError, refreshCart, removeFromCart, updateQuantity } = useCart();
  const navigate = useNavigate();

  const unavailable = cart.some(item => item.product.selling_status && item.product.selling_status !== "active");
  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <div className="cart-container">
      <h1 className="cart-title">Your basket</h1>
      {cartLoading && <p role="status">Loading your basket…</p>}
      {cartError && <p role="alert">{cartError} <button onClick={refreshCart}>Try again</button></p>}

      {unavailable && <p role="alert" className="cart-unavailable">Some items are no longer accepting orders. Remove the marked items to continue to checkout.</p>}
      {cart.length > 0 ? (
        <>
          {cart.map((item) => (
            <div key={item.id} className="cart-item">
              
              {/* LEFT: IMAGE + INFO */}
              <div className="cart-left">
                <div className="cart-image-wrapper">
                  {item.product.image_url ? (
                    <img
                      src={item.product.image_url}
                      alt={item.product.name}
                      className="cart-item-image"
                    />
                  ) : (
                    <div className="cart-image-placeholder">No Image</div>
                  )}
                </div>

                <div className="cart-item-info">
                  <p className="cart-item-name">{item.product.name}</p>
                  {item.product.selling_status && item.product.selling_status !== "active" && <p className="cart-unavailable-label">Orders unavailable · Please remove this item</p>}
                  {item.product.delivery_weekdays?.length > 0 && <p className="cart-delivery-days">{deliveryDaysText(item.product.delivery_weekdays)}</p>}
                  <p className="cart-item-price">
                    {formatPrice(item.product.price)}
                  </p>
                </div>
              </div>

              {/* RIGHT SIDE */}
              <div className="cart-right">
                <div className="qty-controls">
                  <button
                    className="qty-btn"
                    onClick={() =>
                      updateQuantity(item.id, Math.max(1, item.quantity - 1))
                    }
                  >
                    −
                  </button>

                  <span className="qty-number">{item.quantity}</span>

                  <button
                    className="qty-btn"
                    disabled={Boolean(item.product.selling_status && item.product.selling_status !== "active")}
                    onClick={() =>
                      updateQuantity(item.id, item.quantity + 1)
                    }
                  >
                    +
                  </button>
                </div>

                <button
                  className="remove-btn"
                  onClick={() => removeFromCart(item.id)}
                >
                  Remove
                </button>
              </div>

            </div>
          ))}
        </>
      ) : (
        !cartLoading && !cartError && <p>Your basket is empty. Add a meal from the menu to get started.</p>
      )}

      {cart.length > 0 && <div className="cart-total">
        Total: <strong>{formatPrice(total)}</strong>
      </div>}

      {cart.length > 0 && (
        <button
          className="checkout-btn"
          disabled={unavailable || cartLoading || Boolean(cartError)}
          onClick={() => navigate("/checkout")}
        >
          Proceed to Checkout
        </button>
      )}
    </div>
  );
}
