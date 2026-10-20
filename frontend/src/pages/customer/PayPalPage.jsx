import {Link,useSearchParams} from 'react-router-dom';
import PayPalPayment from '../../components/PayPalPayment';
import {ArrowLeft,ShoppingBag} from 'lucide-react';
export default function PayPalPage(){
 const [params]=useSearchParams();const value=params.get('order');
 const orderId=/^[1-9]\d*$/.test(value || '')?Number(value):null;
 return <main className="paypal-payment-page"><Link className="paypal-page-link" to="/orders"><ArrowLeft size={17} aria-hidden="true"/>My orders</Link><h1>PayPal payment</h1>{Number.isSafeInteger(orderId)?<PayPalPayment key={orderId} orderId={orderId}/>:<p>Select a saved PayPal preorder from My orders to continue.</p>}<div className="paypal-page-actions"><Link className="paypal-page-link" to="/menu"><ShoppingBag size={17} aria-hidden="true"/>Browse menu</Link></div></main>;
}
