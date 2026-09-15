import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useUI } from "../../contexts/UIProvider";
import { useCart } from "../../contexts/CartProvider";
import { useOrder } from "../../contexts/OrderProvider";
import "./PaymentPage.css";

export default function PaymentPage() {
    const { setAlert } = useUI();
    const { finalTotal, wallet, walletLoading, createWallet, topupWallet } = useCart();
    const { placeOrder } = useOrder();

    const { method } = useParams();
    const [amount, setAmount] = useState(0);
    const [paying, setPaying] = useState(null);
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
        setPaying(true);
        const success = await placeOrder(addressId, method);
        setPaying(false);

        if (!success) {
            setAlert({ message: "Payment failed. Please try again.", type: "error" });
            return;
        }

        localStorage.removeItem("addressId");
        setAlert({ "message": "Payment successful!", "type": "success" })
        navigate("/orders", { state: { formPayment: true } });
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
            <button className="back-btn" onClick={() => navigate(-1)}>
                ← Back to Checkout
            </button>
        
            {method === "paypal" && <p>Online payment needs server verification setup. Return to checkout and choose cash on delivery.</p>}
            {method === "wallet" && (
            <div className="wallet-box">
                <h3>Demo credit payment</h3>

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