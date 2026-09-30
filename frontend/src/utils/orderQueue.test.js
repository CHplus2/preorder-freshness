import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterOrders,overdueOrder} from './orderQueue.js';
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
