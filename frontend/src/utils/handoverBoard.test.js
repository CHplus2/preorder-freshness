import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handoverBoard,unitTotals} from './handoverBoard.js';

const now=Date.parse('2030-01-09T08:00:00+08:00');
const order={id:1,status:'pending',payment_status:'unpaid',delivery_method:'pickup',delivery_at:'2030-01-09T12:00:00+08:00',preparation_at:'2030-01-09T10:00:00+08:00',preparation_end_at:'2030-01-09T11:30:00+08:00',items:[{id:1,product_name:'Lunch box',quantity:2,selling_details:{unit:'box'}}]};
test('groups Malaysia handovers by hour and method, keeping individual times',()=>{
 const rows=[{...order,id:2,delivery_at:'2030-01-09T04:30:00Z'},order,{...order,id:3,delivery_method:'standard'}];
 const result=handoverBoard(rows,'2030-01-09',now);
 assert.equal(result.groups.length,2);assert.equal(result.confirmed.length,3);
 assert.equal(result.groups.find(g=>g.method==='pickup').orders.length,2);
 assert.equal(result.groups[0].hour,12);assert.equal(rows[0].id,2);
 assert.equal(result.unpaid,3);
});
test('unconfirmed, missing plans and stale preparation are excluded from run totals',()=>{
 const request={...order,id:2,preparation_at:null,preparation_end_at:null,preparation_plan:{needs_review:true,tasks:[]}};
 const stale={...order,id:3,preparation_plan:{tasks:[{start:'2030-01-09T07:00:00+08:00',end:'2030-01-09T07:30:00+08:00'}]}};
 const result=handoverBoard([order,request,stale,{...order,id:4,preparation_at:null}],'2030-01-09',now);
 assert.deepEqual(result.confirmed.map(o=>o.id),[1]);assert.deepEqual(result.requests.map(o=>o.id),[2,3,4]);
});
test('ready and dispatched work stays visible; completed and cancelled work is excluded',()=>{
 const result=handoverBoard(['cooked','shipped','delivered','cancelled'].map((status,i)=>({...order,id:i+1,status,preparation_at:null})),'2030-01-09',now);
 assert.equal(result.confirmed.length,2);assert.equal(result.ready,1);
});
test('overdue follow-up spans dates without including missing dates or completed work',()=>{
 const result=handoverBoard([{...order,delivery_at:'2030-01-08T12:00:00+08:00'},{...order,id:2,delivery_at:null},{...order,id:3,status:'delivered',delivery_at:'2030-01-08T12:00:00+08:00'}],'2030-01-09',now);
 assert.equal(result.overdue.length,1);assert.equal(result.missingDates.length,1);
});
test('quantities keep accepted selling units instead of multiplying servings or pieces',()=>{
 assert.equal(unitTotals([order,{...order,items:[{quantity:6,selling_details:{unit:'portion',serves_min:2,serves_max:3}}]}]),'2 boxes · 6 portions');
});

test('legacy express requests share the delivery run category without rewriting orders',()=>{
 const rows=[{...order,id:2,delivery_method:'standard'},{...order,id:3,delivery_method:'express'}];
 const result=handoverBoard(rows,'2030-01-09',now);
 assert.equal(result.groups.length,1);assert.equal(result.groups[0].method,'standard');
 assert.deepEqual(result.groups[0].orders.map(o=>o.delivery_method),['standard','express']);
 assert.equal(rows[1].delivery_method,'express');
});
