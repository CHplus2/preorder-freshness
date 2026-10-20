import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterOrders,overdueOrder,orderMenuState,orderQueueCounts} from './orderQueue.js';
import {generatedSalesHistory,closedGeneratedHistory} from './orderPresentation.js';
const filters={search:'',status:'',payment:'',date:'',overdue:false,sort:'newest'};
const now=Date.parse('2026-09-30T12:00:00+08:00');
const order={id:21,status:'pending',payment_status:'unpaid',delivery_at:'2026-09-29T20:00:00Z',user:{username:'Buyer'},items:[{product_name:'Rice bowl'}]};
test('search accepts formatted IDs, customers and menu names',()=>{
 for(const search of ['#ORD-00021','buyer','RICE'])assert.equal(filterOrders([order],{...filters,search},now).length,1);
});
test('filters combine and delivery dates use Malaysia timezone',()=>{
 assert.equal(filterOrders([order],{...filters,date:'2026-09-30',payment:'unpaid',status:'pending'},now).length,1);
 assert.equal(filterOrders([order],{...filters,payment:'paid'},now).length,0);
});
test('overdue excludes cancelled, delivered, unscheduled and future orders',()=>{
 assert.equal(overdueOrder(order,now),true);
 for(const change of [{status:'cancelled'},{status:'delivered'},{delivery_at:null},{delivery_at:'2026-10-01T12:00:00Z'}])assert.equal(overdueOrder({...order,...change},now),false);
});
test('delivery ordering puts unscheduled orders last without mutating input',()=>{
 const rows=[{...order,id:22,delivery_at:null},order];
 assert.equal(filterOrders(rows,{...filters,sort:'delivery'},now)[0].id,21);
 assert.equal(rows[0].id,22);
});

const catalogue=[{id:1,selling_status:'archived'},{id:20,selling_status:'active'},{id:21,selling_status:'paused'}];
const oldItems=[{product:1,product_name:'Jasmine Rice'}];
test('menu classification distinguishes current, mixed, archived and missing references',()=>{
 assert.equal(orderMenuState({items:oldItems},catalogue),'archived');
 assert.equal(orderMenuState({items:[{product:20},{product:21}]},catalogue),'current');
 assert.equal(orderMenuState({items:[...oldItems,{product:20}]},catalogue),'mixed');
 for(const items of [[],[{product:null}],[{product:99}],[...oldItems,{product:null}]])assert.equal(orderMenuState({items},catalogue),'unlinked');
 assert.equal(orderMenuState({items:oldItems},null),'unlinked');
});
test('only closed, fully archived history is hidden; open, mixed and unknown records remain',()=>{
 const rows=[{...order,id:1,status:'delivered',items:oldItems},
  {...order,id:2,status:'cancelled',items:oldItems},{...order,id:3,items:oldItems},
  {...order,id:4,status:'delivered',items:[...oldItems,{product:20}]},
  {...order,id:5,status:'delivered',items:[{product:null}]},
  {...order,id:6,status:'delivered',items:[]},
  {...order,id:7,status:'delivered',items:[{product:21}]}];
 const scoped={...filters,includeArchived:false};
 assert.deepEqual(filterOrders(rows,scoped,now,catalogue).map(o=>o.id),[7,6,5,4,3]);
 assert.equal(filterOrders(rows,{...scoped,includeArchived:true},now,catalogue).length,7);
 assert.equal(filterOrders(rows,scoped,now,null).length,7);
 assert.deepEqual(filterOrders(rows,{...scoped,review:'archived-menus'},now,catalogue).map(o=>o.id),[3,2,1]);
 assert.equal(rows[0].id,1);
});
test('missing-date review matches planner warnings, including dated tasks with no delivery',()=>{
 const rows=[{...order,id:1,delivery_at:null},{...order,id:2,delivery_at:'invalid'},
  {...order,id:3,delivery_at:null,status:'delivered'},
  {...order,id:4,delivery_at:null,status:'cancelled'},
  {...order,id:5}, {...order,id:6,delivery_at:null,preparation_plan:{tasks:[{name:'Legacy task'}]}},
  {...order,id:7,delivery_at:null,status:'processing'}];
 assert.deepEqual(filterOrders(rows,{...filters,review:'missing-delivery'},now).map(o=>o.id),[7,6,2,1]);
});
test('generated history has a separate view; open requests and ordinary customers remain in the queue',()=>{
 const generated={...order,id:146,status:'delivered',payment_status:'paid',payment_instructions:{freshcast_synthetic_history:{version:'1'}}};
 const openGenerated={...generated,id:147,status:'pending',delivery_at:null};
 const ordinary={...order,id:148,user:{username:'freshcast_synthetic_history_v1'}};
 const unknownVersion={...generated,id:149,payment_instructions:{freshcast_synthetic_history:{version:'2'}}};
 const rows=[order,generated,openGenerated,ordinary,unknownVersion];
 assert.equal(generatedSalesHistory(generated),true);assert.equal(closedGeneratedHistory(openGenerated),false);
 assert.deepEqual(filterOrders(rows,filters,now).map(o=>o.id),[149,148,147,21]);
 assert.deepEqual(filterOrders(rows,{...filters,historyScope:'generated'},now).map(o=>o.id),[146]);
 assert.equal(filterOrders(rows,{...filters,historyScope:'all'},now).length,5);
 assert.deepEqual(filterOrders(rows,{...filters,review:'missing-delivery'},now).map(o=>o.id),[147]);
 assert.equal(rows[1],generated);assert.equal(generated.status,'delivered');
});


test('owner shortcuts distinguish open, confirmation, dispatch and past-due work from closed history',()=>{
 const rows=[{...order,id:1,delivery_at:'2026-10-02T12:00:00Z'},
  {...order,id:2,preparation_plan:{needs_review:true}},
  {...order,id:3,status:'cooked'}, {...order,id:4,status:'shipped',delivery_at:'2026-10-02T12:00:00Z'},
  {...order,id:5,status:'delivered'}, {...order,id:6,status:'cancelled'},
  {...order,id:7,delivery_at:null}, {...order,id:8,status:'delivered',payment_instructions:{freshcast_synthetic_history:{version:'1'}}}];
 assert.deepEqual(orderQueueCounts(rows,now),{open:5,requests:1,ready:2,overdue:2,all:7});
 for(const [queue,expected] of [['open',[7,4,3,2,1]],['requests',[2]],['ready',[4,3]],['overdue',[3,2]],['all',[7,6,5,4,3,2,1]]])
  assert.deepEqual(filterOrders(rows,{...filters,queue},now).map(o=>o.id),expected);
 assert.deepEqual(filterOrders(rows,{...filters,queue:'open',payment:'paid'},now),[]);
 assert.equal(filterOrders(rows,{...filters,queue:'open',review:'missing-delivery'},now).length,1);
 assert.equal(rows[0].id,1);
});
