import { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useUI } from "../../contexts/UIContext";
import { useCart } from "../../contexts/CartContext";
import { useOrder } from "../../contexts/OrderContext";
import "./PaymentPage.css";
import {apiError} from "../../utils/apiError";

export default function PaymentPage() {
    const { setAlert } = useUI();
    const { finalTotal, wallet, walletLoading, createWallet, topupWallet } = useCart();
    const { placeOrder } = useOrder();

    const { method } = useParams();
    const [amount, setAmount] = useState(0);
    const [paying, setPaying] = useState(false);
    const [paymentError,setPaymentError]=useState("");
    const location = useLocation();
    const addressId = location.state?.addressId || Number(localStorage.getItem("addressId"));

    const navigate = useNavigate();

    useEffect(() => {
        if (!addressId) {
            setAlert({ message: "Session expired. Please checkout again", type: "error" })
            navigate("/checkout")
        }
    }, [addressId, setAlert, navigate])

    const handlePay = async () => {
        if(paying)return;
        setPaymentError("");
        setPaying(true);
        try {
            const success = await placeOrder(addressId, method, {throwOnError:true});
            // Only a confirmed order response is treated as a completed demo debit.
            if (!success) return;
            try { localStorage.removeItem("addressId"); } catch { /* Order already accepted. */ }
            setAlert({ message: success.needs_review ? "Request sent to the kitchen. No credits were deducted; payment is cash on delivery after confirmation." : success.payment_method==='wallet' && success.payment_status==='paid' ? "Order placed using demo credits. No real money was charged." : "Order saved. Check My orders for its payment and confirmation status.", type: "success" });
            navigate("/orders", { state: { formPayment: true } });
        } catch(error) {
            setPaymentError(apiError(error));
        } finally {
            setPaying(false);
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!wallet || amount <= 0) {
            setAlert({ message: "Enter a valid top-up amount", type:"error" });
            return;
        }

        topupWallet(amount);
        setAmount(0);
    }

    return (    
        <div className="payment-container">
            <Link className="payment-back" to="/checkout">Back to checkout</Link>
            {paymentError && <div role="alert" className="payment-error"><p>{paymentError}</p><Link to="/orders">Check my orders</Link><p>Review the delivery date and basket at checkout before retrying.</p></div>}
        
            {method === "paypal" && <p>Online payment needs server verification setup. Return to checkout and choose cash on delivery.</p>}
            {method === "wallet" && (
            <div className="wallet-box">
                <p>If the kitchen needs to review preparation, your request will be saved without charging credits, with payment on delivery.</p><h3>Demo credit payment</h3><p>For demonstration only. These credits are not real money.</p>

                <div className="payment-summary">
                <p><strong>Total:</strong> {finalTotal.toFixed(2)} demo credits</p>

                {wallet && (
                    <p>
                    <strong>Your Balance:</strong> {Number(wallet.balance).toFixed(2)} demo credits
                    </p>
                )}
                </div>

                {walletLoading ? (
                <p className="loading-text">Loading wallet...</p>
                ) : !wallet ? (
                <button className="primary-btn" onClick={createWallet}>
                    Create Wallet
                </button>
                ) : wallet.balance < finalTotal ? (
                <div className="topup-section">
                    <p className="warning-text">
                    Insufficient balance. You need {(finalTotal - wallet.balance).toFixed(2)} demo credits more.
                    </p>

                    <form onSubmit={handleSubmit}>
                    <input
                        type="number"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        min="0"
                        step="0.01"
                    />
                    <button className="secondary-btn" type="submit" disabled={!wallet || amount <= 0}>
                        Top Up
                    </button>
                    </form>
                </div>
                ) : (
                <button className="primary-btn" onClick={handlePay} disabled={paying}>
                    {paying ? "Processing..." : `Pay ${finalTotal.toFixed(2)} demo credits`}
                </button>
                )}
            </div>
            )}
        </div>
    );
}