import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUI } from "../../contexts/UIProvider";
import { useCart } from "../../contexts/CartProvider";
import { useOrder } from "../../contexts/OrderProvider";
import { getCookie } from "../../utils/cookieUtils";
import "./CheckoutPage.css";
import axios from "axios";

export default function CheckoutPage() {
  const [openedAt]=useState(()=>Date.now());
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    delivery_at: "",
    delivery_method: "standard",
    name: "",
    line1: "",
    city: "",
    state: "",
    postal_code: "",
    phone: "",
    payment: "",
  });
  const { formatPrice, setAlert } = useUI();
  const { cart, total, SHIPPING_FEE, finalTotal, discount, promotion } = useCart();
  const { placeOrder } = useOrder();
  const navigate = useNavigate();
  const notice = Math.max(0,...cart.map(i=>i.product.lead_hours || 24));
  const cooking = cart.reduce((n,i)=>n+(i.product.preparation_minutes || 60),0);
  const localInput = d=>new Date(d.getTime()+8*3600000).toISOString().slice(0,16);
  const earliest = localInput(new Date(openedAt+(notice*60+cooking+(promotion?.delivery_buffer_minutes || 90))*60000));
  const latest = localInput(new Date(openedAt+90*86400000));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    sessionStorage.setItem("deliveryPlan", JSON.stringify({delivery_at: form.delivery_at + ":00+08:00", delivery_method: form.delivery_method}));
    // Create address
    let data;
    try {
      const res = await axios.post("/api/addresses/", {
        line1: form.line1,
        city: form.city,
        state: form.state,
        postal_code: form.postal_code,
        phone: form.phone,
      }, {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      data = res.data;
    } catch (err) {
      setLoading(false);
      setAlert({ message: "Address could not be saved", type: "error" });
      console.error("createAddress:", err.response?.data || err.message);
      return;
    }

    if (!data.id) {
      setLoading(false);
      setAlert({ message: "Address could not be saved", type: "error" });
      return;
    }

    setLoading(true);

    if (form.payment === "cod") {
      const success = await placeOrder(data.id, form.payment);
      setLoading(false);

      if (!success) {
        setAlert({ message: "Order failed. Please try again.", type: "error" });
        return;
      }

      navigate("/orders", { state: { formPayment: true } });
      return;
    }

    localStorage.setItem("addressId", data.id);
    navigate(`/payment/${form.payment}`, { state: { addressId: data.id }});
  };

  return (
    <div className="checkout-container">
      <h2 className="checkout-title">Checkout</h2>

      <div className="checkout-grid">

        {/* LEFT: FORM */}
        <div className="checkout-left">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back to Cart
          </button>
          <form className="checkout-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <h4>Plan your delivery</h4>
              <p>Choose a date up to 90 days ahead, 9am–9pm Malaysia time. Each menu needs advance notice, cooking time and a {promotion?.delivery_buffer_minutes || 90}-minute travel/contingency buffer. Your owner confirms fulfilment.</p>
              <p>For this basket: {notice}h notice + {cooking} minutes cooking + {promotion?.delivery_buffer_minutes || 90} minutes delivery buffer.</p>
              <label>Requested delivery date and time (Malaysia)
                <input className="checkout-input" type="datetime-local" min={earliest} max={latest} required value={form.delivery_at} onChange={e => setForm({...form, delivery_at:e.target.value})}/>
              </label>
              <label>Delivery service
                <select className="checkout-input" value={form.delivery_method} onChange={e => setForm({...form, delivery_method:e.target.value})}>
                  <option value="standard">Owner delivery</option><option value="express">Request express — owner confirmation required</option>
                </select>
              </label>
              <p>Express requests retain the menu lead time. Any courier arrangement or additional charge must be agreed with the owner.</p>
              <h4>Delivery address</h4>
                <input
                className="checkout-input"
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <input
                className="checkout-input"
                placeholder="Street Address"
                value={form.line1}
                onChange={(e) => setForm({ ...form, line1: e.target.value })}
                required
              />

              <input
                className="checkout-input"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
              />

              <input
                className="checkout-input"
                placeholder="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                required
              />

              <input
                className="checkout-input"
                placeholder="Postal Code"
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                required
              />

              <input
                className="checkout-input"
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>

            <div className="form-section">
              <h4>Payment</h4>
              <div className="payment-options">
                <label>
                  <input type="radio"
                  name="payment"
                  value="cod"
                  onChange={(e) => setForm(
                    { ...form, payment: e.target.value }
                  )}
                  required
                  />
                  Cash on Delivery
                </label>

                <label>
                  <input
                  type="radio"
                  name="payment"
                  value="paypal" disabled
                  onChange={
                    (e) => setForm(
                      { ...form, payment: e.target.value }
                    )}
                  required
                  />
                  PayPal (setup required)
                </label>

                <label>
                  <input
                  type="radio"
                  name="payment"
                  value="wallet"
                  onChange={
                    (e) => setForm(
                      { ...form, payment: e.target.value }
                    )}
                  required
                  />
                  Demo credit wallet
                </label>
              </div>
            </div>

            <button className="checkout-submit" type="submit" disabled={loading}>
              {loading ? "Processing..." : "Proceed to Payment"}
            </button>
          </form>
        </div>

        {/* RIGHT: ORDER SUMMARY */}
        <div className="checkout-right">
          <h3 className="summary-title">Order Summary</h3>
          <p className="summary-subtitle">Secure checkout</p>

          {cart.map((item) => (
            <div key={item.id} className="summary-item">
              <span>{item.product.name}</span>
              <span>x{item.quantity}</span>
              <span>{formatPrice(item.product.price * item.quantity)}</span>
            </div>
          ))}

          <div className="summary-breakdown">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatPrice(total)}</span>
            </div>

            <div className="summary-row"><span>Bulk discount</span><span>−{formatPrice(discount)}</span></div>
            <div className="summary-row">
              <span>Shipping Fee</span>
              <span>{SHIPPING_FEE > 0 ? formatPrice(SHIPPING_FEE) : "Free"}</span>
            </div>
          </div>

          {total < 50 && (
            <p className="summary-note">
              Add {formatPrice(50 - total)} more for free shipping!
            </p>
          )}

          <div className="summary-total">
            Total: <strong>{formatPrice(finalTotal)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
