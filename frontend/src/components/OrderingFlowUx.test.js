import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const load=path=>server.ssrLoadModule('/src/'+path);
 const {default:Header}=await load('components/MenuKitchenHeader.jsx');
 const header=renderToStaticMarkup(h(MemoryRouter,null,h(Header,{store:{name:'Kitchen',ordering_mode:'simple',delivery_enabled:true,pickup_enabled:true,pickup_location:'Kitchen counter',delivery_start_time:'07:30:00',delivery_end_time:'11:00:00',pickup_start_time:'08:15:00',pickup_end_time:'10:45:00',delivery_open_hour:9,delivery_close_hour:21}})));
 assert.match(header,/7:30am–11am/);assert.match(header,/8:15am–10:45am/);assert.doesNotMatch(header,/9am–9pm|times in your basket/);assert.match(header,/Checkout checks all items together/);
 const {default:Action}=await load('components/CheckoutAction.jsx');
 const action=props=>renderToStaticMarkup(h(Action,{finalTotal:21,foodTotal:13,formatPrice:value=>'RM '+Number(value).toFixed(2),...props}));
 assert.match(action({shippingPending:true,disabled:true,nextStep:'Choose your area.'}),/Food total/);assert.match(action({shippingPending:true,disabled:true}),/RM 13.00/);
 const ready=action({confirmed:true});assert.match(ready,/Place preorder · RM 21.00/);assert.doesNotMatch(ready,/Estimated total/);
 const waiting=action({disabled:true,confirmed:false,nextStep:'Choose a time.'});assert.match(waiting,/Estimated total/);assert.match(waiting,/aria-describedby="checkout-next-step"/);assert.doesNotMatch(waiting,/Place preorder · RM/);
 const {default:Checkout}=await load('pages/customer/SimpleCheckoutPage.jsx');
 const {AuthContext}=await load('contexts/AuthContext.js'),{CartContext}=await load('contexts/CartContext.js'),{OrderContext}=await load('contexts/OrderContext.js'),{UIContext}=await load('contexts/UIContext.js'),{StoreContext}=await load('contexts/StorefrontContext.js');
 const promotion={ordering_mode:'simple',delivery_enabled:true,pickup_enabled:true,pickup_location:'Kitchen counter',delivery_areas:['Petra Jaya'],delivery_area_fees:{'Petra Jaya':'8.00'},delivery_fee_myr:'8.00',manual_payment_enabled:true,duitnow_qr_url:'/api/menu-photos/local-qr/'};
 const render=changes=>renderToStaticMarkup(h(MemoryRouter,null,h(AuthContext.Provider,{value:{customerAccount:{name:'Buyer',phone:'+60123456789'},isSessionCurrent:()=>true}},h(StoreContext.Provider,{value:{store:promotion}},h(UIContext.Provider,{value:{formatPrice:value=>'RM '+Number(value).toFixed(2)}},h(OrderContext.Provider,{value:{}},h(CartContext.Provider,{value:{cart:[{id:1,quantity:1,product:{id:1,name:'Salad',price:'13.00'}}],pricingReady:true,promotion,total:13,discount:0,SHIPPING_FEE:8,finalTotal:21,chooseDeliveryTime:()=>{},...changes}},h(Checkout))))))));
 const checkout=render({});assert.ok(checkout.indexOf('id="checkout-time"')<checkout.indexOf('id="checkout-contact"'));assert.ok(checkout.indexOf('id="checkout-contact"')<checkout.indexOf('id="checkout-payment"'));
 assert.match(checkout,/Preorder steps/);assert.match(checkout,/client-order-action order-action-bar/);assert.match(checkout,/Choose your delivery area above/);
 const loading=render({pricingReady:false});assert.match(loading,/role="status"/);assert.doesNotMatch(loading,/role="alert"|checkout-retry/);
 const failed=render({pricingReady:false,pricingError:'Pricing unavailable'});assert.match(failed,/role="alert"/);assert.match(failed,/>Retry<\/button>/);assert.match(failed,/href="\/cart"[^>]*>Basket<\/a>/);assert.match(failed,/Your basket is saved/);assert.doesNotMatch(failed,/class="checkout-error"/);
 const retrying=render({pricingReady:false,pricingError:'Pricing unavailable',pricingRefreshing:true});assert.match(retrying,/<button[^>]*disabled=""[^>]*>Retrying…<\/button>/);
 const basketFailure=render({cartError:'Your basket could not be loaded.'});assert.match(basketFailure,/Your basket could not be loaded/);
 console.log('Ordering flow: real service hours, time-before-contact, honest totals/loading and explicit blocked-action guidance passed.');
}finally{await server.close()}
