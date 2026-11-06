import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {PaymentSummary,PaymentLedger}=await server.ssrLoadModule('/src/components/PaymentRecords.jsx');
 const summary=renderToStaticMarkup(h(PaymentSummary,{order:{payment_method:'manual'},data:{payment_status:'unpaid',amount:'28.00'}}));
 assert.match(summary,/Order total/);assert.match(summary,/RM 28\.00/);assert.match(summary,/Not recorded/);assert.match(summary,/Bank QR \/ transfer/);
 const record={id:1,kind:'receipt',outcome:'completed',amount:'28.00',reference:'1',note:'<script>alert(1)</script>',method:'manual',source:'owner_verified',actor:2,created_at:'2026-11-06T01:18:49Z'};
 const ledger=renderToStaticMarkup(h(PaymentLedger,{events:[record]}));
 assert.match(ledger,/Payment received/);assert.match(ledger,/<dt>Reference<\/dt><dd>1<\/dd>/);assert.match(ledger,/Malaysia time/);
 assert.match(ledger,/&lt;script&gt;/);assert.doesNotMatch(ledger,/<script>/);assert.match(renderToStaticMarkup(h(PaymentLedger,{events:[]})),/No payment or refund records yet/);
 const {default:Review}=await server.ssrLoadModule('/src/components/OrderReceiptReview.jsx');
 const orders=[{id:2,delivery_method:'standard',fulfilment_snapshot:{customer:{name:'Buyer <b>one</b>'}},delivery_at:'2026-11-07T00:30:00Z'},{id:3,delivery_method:'pickup',fulfilment_snapshot:{customer:{name:'Buyer two'}}}];
 const review=renderToStaticMarkup(h(Review,{orders,formatOrderNumber:id=>'ORD-'+id}));
 assert.match(review,/2 orders to update/);assert.match(review,/#ORD-2/);assert.match(review,/#ORD-3/);assert.match(review,/Self-collection/);assert.match(review,/Buyer &lt;b&gt;one&lt;\/b&gt;/);
 const {StoreContext}=await server.ssrLoadModule('/src/contexts/StorefrontContext.js');
 const {OrderContext}=await server.ssrLoadModule('/src/contexts/OrderContext.js');
 const {UIContext}=await server.ssrLoadModule('/src/contexts/UIContext.js');
 const {default:Orders}=await server.ssrLoadModule('/src/pages/admin/SimpleOrdersPage.jsx');
 const order={...orders[0],status:'pending',payment_status:'unpaid',payment_method:'manual',total_amount:'20.00',shipping_fee:'8.00',created_at:'2026-11-06T00:00:00Z',items:[{id:1,product_name:'Salad',quantity:1}]};
 const render=(adminOrdersError='',adminOrders=[order])=>renderToStaticMarkup(h(MemoryRouter,null,h(StoreContext.Provider,{value:{store:{ordering_mode:'simple'}}},h(OrderContext.Provider,{value:{adminOrders,fetchAdminOrders:()=>{},adminOrdersLoading:false,adminOrdersError}},h(UIContext.Provider,{value:{formatOrderNumber:id=>'ORD-'+id,setAlert:()=>{}}},h(Orders))))));
 const queue=render();assert.match(queue,/Review payment/);assert.match(queue,/Payment: Not recorded/);assert.match(queue,/simple-order-primary/);assert.match(queue,/Contact &amp; order details/);assert.match(queue,/Preview &amp; print/);
 assert.doesNotMatch(queue,/Payment records · order|role="dialog"/);
 assert.doesNotMatch(render('Server unavailable',[]),/No orders in this view/);
 console.log('Order/payment UX: separate receipt/payment, exact confirmation scope, escaped references and honest error state passed.');
}finally{await server.close()}
