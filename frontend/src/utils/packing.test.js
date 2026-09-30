import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packingList} from './packing.js';
const order = {id:1,status:'pending',delivery_at:'2026-10-02T16:00:00Z',items:[{id:1,product:5,product_name:'Rice',quantity:2}]};
test('uses Malaysia date and excludes dispatched, completed and cancelled orders',()=>{
 const rows=[order,...['shipped','delivered','cancelled'].map(status=>({...order,status,id:2}))];
 assert.equal(packingList(rows,'2026-10-03').orders.length,1);
 assert.equal(packingList(rows,'2026-10-02').orders.length,0);
});
test('totals all order lines without combining renamed menus',()=>{
 const result=packingList([order,{...order,id:2,items:[{...order.items[0],id:2,quantity:3},{id:3,product:5,product_name:'New rice',quantity:1}]}],'2026-10-03');
 assert.equal(result.portions,6);assert.equal(result.menus.length,2);
 assert.equal(result.menus.find(m=>m.name==='Rice').quantity,5);
});
test('reports missing dates and sorts deliveries without mutating source',()=>{
 const rows=[{...order,id:2,delivery_at:'2026-10-03T12:00:00Z'},order,{...order,id:3,delivery_at:null}];
 const result=packingList(rows,'2026-10-03');assert.deepEqual(result.orders.map(o=>o.id),[1,2]);
 assert.equal(result.unscheduled,1);assert.equal(rows[0].id,2);
});
test('keeps deleted product lines distinct and includes cooked orders',()=>{
 const result=packingList([{...order,status:'cooked',items:[{id:1,product:null,product_name:'Rice',quantity:1},{id:2,product:null,product_name:'Rice',quantity:2}]}],'2026-10-03');
 assert.equal(result.menus.length,2);assert.equal(result.portions,3);
});
