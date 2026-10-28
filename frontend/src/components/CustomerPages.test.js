import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:OrdersPage}=await server.ssrLoadModule('/src/pages/customer/OrdersPage.jsx');
 const {OrderContext}=await server.ssrLoadModule('/src/contexts/OrderContext.js');
 const {UIContext}=await server.ssrLoadModule('/src/contexts/UIContext.js');
 const base={id:1,status:'pending',items:[],delivery_method:'standard',shipping_fee:'5',total_amount:'12',discount_amount:'0',payment_status:'unpaid',preparation_plan:{needs_review:true,tasks:[]}};
 const render=changes=>renderToStaticMarkup(h(MemoryRouter,null,h(UIContext.Provider,{value:{formatOrderNumber:id=>'ORD-'+id,setAlert:()=>{}}},h(OrderContext.Provider,{value:{orders:[base,{...base,id:2,status:'delivered'}],fetchOrders:()=>{},ordersLoading:false,ordersError:'',...changes}},h(OrdersPage)))));
 const current=render({});
 assert.match(current,/Delivery request #ORD-1/);assert.doesNotMatch(current,/Order #ORD-2/);
 assert.match(current,/Awaiting kitchen confirmation/);assert.match(current,/No payment was taken/);
 assert.match(current,/contact\?order=1/);assert.match(current,/History/);
 assert.ok(current.indexOf('class="order-body"')<current.indexOf('class="order-progress"'));
 assert.match(current,/<details class="customer-order-more"><summary>Receipt &amp; order preferences/);
 assert.doesNotMatch(current,/<details class="customer-order-more" open/);
 const pickup=render({orders:[{...base,delivery_method:'pickup'}]});assert.match(pickup,/This collection time is requested/);assert.doesNotMatch(pickup,/This delivery time is requested/);
 const tracked=render({orders:[{...base,fulfilment_snapshot:{courier:{carrier:'Fixture courier',reference:'F-123',url:'https://courier.example.test/track/F-123'}}}]});assert.match(tracked,/class="customer-track-link"/);assert.match(tracked,/Track with Fixture courier/);
 const unsafeTracking=render({orders:[{...base,fulfilment_snapshot:{courier:{url:'javascript:alert(1)'}}}]});assert.doesNotMatch(unsafeTracking,/class="customer-track-link"/);
 for(const state of [{ordersLoading:true},{ordersError:'Read failed'}]){
  const html=render(state);assert.doesNotMatch(html,/<article|Change delivery time|Continue to payment/);
  assert.doesNotMatch(html,/Your next meal starts here|Showing [0-9]/);
 }
 const history=render({orders:[{...base,id:2,status:'delivered'}]});
 assert.match(history,/Order #ORD-2/);assert.match(history,/Showing 1 of 1 past orders/);
 const many=render({orders:Array.from({length:14},(_,i)=>({...base,id:i+1}))});
 assert.equal((many.match(/<article/g)||[]).length,10);assert.match(many,/Show 10 more orders/);
 assert.match(render({orders:[]}),/Your next meal starts here/);
 const {default:HomeMenuPreview}=await server.ssrLoadModule('/src/components/HomeMenuPreview.jsx');
 const home=renderToStaticMarkup(h(MemoryRouter,null,h(HomeMenuPreview)));
 assert.match(home,/Loading the kitchen/);assert.doesNotMatch(home,/No menus are available/);
 console.log('Customer pages: current/history, request/payment distinction, bounded rendering and stale-action guards passed.');
}finally{await server.close();}
