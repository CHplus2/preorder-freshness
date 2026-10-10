import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useUI } from "../../contexts/UIContext";
import { useCart } from "../../contexts/CartContext";
import { useOrder } from "../../contexts/OrderContext";
import "./PaymentPage.css";
import {apiError} from "../../utils/apiError";

export default function PaymentPage() {
    const { setAlert } = useUI();
    const { cart, cartLoading, cartError, refreshCart, finalTotal, wallet, walletLoading, walletError, refreshWallet, createWallet, topupWallet } = useCart();
    const { placeOrder } = useOrder();

    const { method } = useParams();
    const [amount, setAmount] = useState('');
    const [paying, setPaying] = useState(false);
    const [walletBusy,setWalletBusy]=useState(false);
    const walletOperation=useRef(false);
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

    const changeWallet = async action => {
        if(walletOperation.current)return false;
        walletOperation.current=true;setWalletBusy(true);
        try{return await action();}
        finally{walletOperation.current=false;setWalletBusy(false);}
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!wallet || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            setAlert({ message: "Enter a valid top-up amount", type:"error" });
            return;
        }

        if(await changeWallet(()=>topupWallet(amount)))setAmount('');
    }

    return (    
        <div className="payment-container">
            <Link className="payment-back" to="/checkout">Back to checkout</Link>
            <h1 className="payment-title">{method==='wallet'?'Demo credit payment':'Payment unavailable'}</h1>
            {paymentError && <div role="alert" className="payment-error"><p>{paymentError}</p><Link to="/orders">Check my orders</Link><p>Review the delivery date and basket at checkout before retrying.</p></div>}
        
            {method !== "wallet" && <p>This payment method is unavailable here. Return to checkout to choose an available method.</p>}
            {method === "wallet" && (
            <div className="wallet-box">
                <p className="payment-sub">These credits are for demonstration and have no monetary value.</p>
                <details><summary>If preparation needs review</summary><p>The kitchen receives an unpaid request with cash on delivery. No demo credits are deducted.</p></details>

                <div className="payment-summary">
                <p><strong>Total:</strong> {finalTotal.toFixed(2)} demo credits</p>

                {wallet && (
                    <p>
                    <strong>Your Balance:</strong> {Number(wallet.balance).toFixed(2)} demo credits
                    </p>
                )}
                </div>

                {cartLoading || walletLoading ? (
                <p className="loading-text" role="status">Loading your basket and wallet…</p>
                ) : cartError ? (
                <div role="alert"><p>{cartError}</p><button className="secondary-btn" onClick={refreshCart}>Retry basket</button></div>
                ) : !cart.length ? (
                <p>Your basket is empty. <Link to="/menu">Browse the menu</Link></p>
                ) : walletError ? (
                <div role="alert"><p>{walletError}</p><button className="secondary-btn" onClick={refreshWallet}>Retry wallet</button></div>
                ) : !wallet ? (
                <button className="primary-btn" disabled={walletBusy} onClick={()=>changeWallet(createWallet)}>
                    {walletBusy?'Creating…':'Create demo wallet'}
                </button>
                ) : wallet.balance < finalTotal ? (
                <div className="topup-section">
                    <p className="warning-text">
                    Insufficient balance. You need {(finalTotal - wallet.balance).toFixed(2)} demo credits more.
                    </p>

                    <form onSubmit={handleSubmit}>
                    <label htmlFor="demo-topup">Demo credits to add</label>
                    <input
                        id="demo-topup"
                        type="number"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="0.01"
                        step="0.01"
                        required
                        disabled={walletBusy}
                    />
                    <button className="secondary-btn" type="submit" disabled={walletBusy || !wallet || !Number.isFinite(Number(amount)) || Number(amount) <= 0}>
                        {walletBusy?'Adding credits…':'Add demo credits'}
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
