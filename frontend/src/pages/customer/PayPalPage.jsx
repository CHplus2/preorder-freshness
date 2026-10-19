import {Link,useSearchParams} from 'react-router-dom';
import PayPalPayment from '../../components/PayPalPayment';
export default function PayPalPage(){
 const [params]=useSearchParams();const value=params.get('order');
 const orderId=/^[1-9]\d*$/.test(value || '')?Number(value):null;
 return <main className="paypal-payment-page"><Link to="/orders">← My orders</Link><h1>PayPal test checkout</h1>{Number.isSafeInteger(orderId)?<PayPalPayment key={orderId} orderId={orderId}/>:<p>Select a saved PayPal preorder from My orders to continue.</p>}<Link to="/menu">Continue browsing the menu</Link></main>;
}
