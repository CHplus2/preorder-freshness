import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderProgress,orderStages,unconfirmedDeliveryRequest} from './orderProgress.js';
test('each recorded status has exactly one current stage',()=>{
 for(const [status] of orderStages){const p=orderProgress(status);assert.equal(p.stages.filter(s=>s.state==='current').length,1);assert.equal(p.stages[p.index].key,status);assert.equal(p.stages.filter(s=>s.state==='complete').length,p.index);}
});
test('cancelled and unknown statuses do not invent completed stages',()=>{
 assert.deepEqual(orderProgress('cancelled').stages,[]);assert.equal(orderProgress('cancelled').label,'Cancelled');
 assert.deepEqual(orderProgress('unexpected').stages,[]);
});
test('self-collection has a collected outcome and no out-for-delivery stage',()=>{
 const progress=orderProgress('cooked',false,true);
 assert.equal(progress.label,'Ready for collection');
 assert.equal(progress.stages.some(s=>s.key==='shipped'),false);
 assert.equal(orderProgress('delivered',false,true).label,'Collected');
 assert.equal(orderProgress('pending',true,true).label,'Collection request sent');
});

test('unconfirmed requests have no fulfilment stage or booked-time promise',()=>{
 const request={status:'pending',delivery_at:'2026-10-20T16:00:00+08:00',preparation_plan:{needs_review:true,tasks:[]}};
 assert.equal(unconfirmedDeliveryRequest(request),true);
 assert.equal(orderProgress('pending',true).label,'Delivery request sent');
 assert.deepEqual(orderProgress('pending',true).stages,[]);
 assert.equal(unconfirmedDeliveryRequest({...request,inventory_deducted:true}),false);
 assert.equal(unconfirmedDeliveryRequest({...request,preparation_at:'2026-10-20T10:00:00+08:00'}),false);
 assert.equal(unconfirmedDeliveryRequest({...request,preparation_plan:{needs_review:true,tasks:[{name:'Reserved work'}]}}),false);
 assert.equal(unconfirmedDeliveryRequest({...request,status:'processing'}),false);
 assert.equal(orderProgress('delivered',true).label,'Delivered');
});
