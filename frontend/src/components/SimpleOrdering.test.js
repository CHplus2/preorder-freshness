import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const load=path=>server.ssrLoadModule('/src/'+path);
 const {StoreContext}=await load('contexts/StorefrontContext.js');
 const {OrderContext}=await load('contexts/OrderContext.js');
 const {UIContext}=await load('contexts/UIContext.js');
 const {CartContext}=await load('contexts/CartContext.js');
 const {AuthContext}=await load('contexts/AuthContext.js');
 const order={id:1,ordering_mode:'simple',status:'pending',updated_at:'2026-11-01T09:00:00Z',created_at:'2026-11-01T09:00:00Z',delivery_at:'2026-11-02T02:00:00Z',delivery_method:'standard',inventory_deducted:true,payment_status:'unpaid',total_amount:'24',shipping_fee:'5',fulfilment_snapshot:{},user:{username:'Test buyer'},items:[{id:1,product:1,product_name:'Rice meal',quantity:2,selling_details:{}}]};
 const orderState={adminOrders:[order],fetchAdminOrders:()=>{},adminOrdersLoading:false,adminOrdersError:''};
 const providers=[[StoreContext,{store:{ordering_mode:'simple',delivery_open_hour:9,delivery_close_hour:21}}],
  [OrderContext,orderState],
  [UIContext,{formatOrderNumber:id=>'ORD-'+id,formatPrice:x=>'RM '+Number(x).toFixed(2),setAlert:()=>{}}],
  [CartContext,{cart:[],addToCart:()=>{}}],[AuthContext,{isAuthenticated:false}]];
 const render=node=>renderToStaticMarkup(providers.reduceRight((child,[context,value])=>h(context.Provider,{value},child),h(MemoryRouter,null,node)));
 const {default:AdminOrders}=await load('pages/admin/AdminOrdersPage.jsx');
 const owner=render(h(AdminOrders));
 assert.match(owner,/Mark received/);assert.match(owner,/Not received/);assert.match(owner,/Review payment/);
 assert.doesNotMatch(owner,/Open Planner|Food ready|Preparation starts|Plan delivery &amp; preparation|Out for delivery/);
 orderState.adminOrders=Array.from({length:158},(_,index)=>({...order,id:index+1,
  status:index<2?'pending':index<152?'delivered':'cancelled',
  payment_instructions:{catalogue_refresh_sample:{version:'1'}}}));
 const queue=render(h(AdminOrders));
 assert.match(queue,/Not received <span class="simple-orders-count">2<\/span>/);
 assert.match(queue,/Received <span class="simple-orders-count">150<\/span>/);
 assert.match(queue,/Cancelled <span class="simple-orders-count">6<\/span>/);
 assert.match(queue,/All orders <span class="simple-orders-count">158<\/span>/);
 assert.match(queue,/Showing 2 of 2 orders in this view · 158 total/);
 assert.match(queue,/Sort orders<select/);
 for(const label of ['Delivery date: earliest first','Delivery date: latest first','Order placed: newest first','Order placed: oldest first'])assert.ok(queue.includes(label));
 orderState.adminOrders=[order];
 const {default:Progress}=await load('components/OrderProgress.jsx');
 assert.match(render(h(Progress,{order})),/Not received/);
 assert.match(render(h(Progress,{order:{...order,status:'delivered'}})),/Received/);
 assert.doesNotMatch(render(h(Progress,{order})),/Preparing|Ready for delivery|preparation slot/);
 const {default:Picker}=await load('components/DeliveryTimePicker.jsx');
 const picker=render(h(Picker,{value:'2026-11-02T10:00',onSelect:()=>{}}));
 assert.match(picker,/type="time"/);assert.match(picker,/type="date"/);
 assert.doesNotMatch(picker,/Need a different time|preparation|kitchen bookings/);
 const offered=render(h(Picker,{cart:[{product:{name:'Monday menu',delivery_weekdays:[0]}}],onSelect:()=>{}}));
 assert.match(offered,/Offered for this basket/);assert.match(offered,/Upcoming ordering dates/);assert.match(offered,/Availability is confirmed after you choose a time/);
 const incompatible=render(h(Picker,{cart:[{product:{name:'Monday menu',delivery_weekdays:[0]}},{product:{name:'Tuesday menu',delivery_weekdays:[1]}}],onSelect:()=>{}}));
 assert.match(incompatible,/no delivery weekday in common/);assert.match(incompatible,/Edit basket/);assert.doesNotMatch(incompatible,/role="group" aria-label="Upcoming ordering dates"/);
 const {default:Recipe}=await load('components/RecipeEditor.jsx');
 const recipe=render(h(Recipe,{value:{ingredients:[],preparation_tasks:[],lead_hours:24,daily_capacity:30},onChange:()=>{}}));
 assert.match(recipe,/Recipe &amp; preorder settings/);assert.match(recipe,/Collection &amp; delivery weekdays/);
 assert.doesNotMatch(recipe,/Advance notice|Production limits|Preparation across days|preparation steps/);
 const {default:FoodCard}=await load('components/MenuFoodCard.jsx');
 const card=render(h(FoodCard,{product:{id:1,name:'Meal',price:12,lead_hours:24,daily_capacity:1,selling_status:'active',selling_details:{}}}));
 assert.doesNotMatch(card,/24h notice|up to 1 \/ day/);assert.match(card,/stock checked at checkout/);
 console.log('Simple ordering UI: receipt-only actions, direct date/time entry, recipe editing and stock-based menu copy passed.');
}finally{await server.close();}
