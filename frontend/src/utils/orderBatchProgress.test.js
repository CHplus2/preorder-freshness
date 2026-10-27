import assert from 'node:assert/strict';
import {hasPreparationPlan,batchEligible,validateBatchResult} from './orderBatchProgress.js';
const order={id:12,status:'pending',updated_at:'2026-10-27T02:00:00.123456Z',payment_status:'unpaid',delivery_method:'standard',
 preparation_at:'2026-10-27T10:00:00+08:00',preparation_end_at:'2026-10-27T12:00:00+08:00',delivery_at:'2026-10-27T15:00:00+08:00'};
assert.equal(hasPreparationPlan(order),true);
assert.equal(batchEligible(order,'cooked'),true);
assert.equal(batchEligible({...order,status:'processing',preparation_end_at:null},'cooked'),false);
assert.equal(batchEligible({...order,preparation_plan:{needs_review:true}},'cooked'),false);
assert.equal(batchEligible({...order,updated_at:null},'cooked'),false);
assert.equal(batchEligible({...order,status:'cooked'},'shipped'),true);
assert.equal(batchEligible({...order,status:'cooked',delivery_method:'pickup'},'shipped'),false);
assert.equal(batchEligible({...order,status:'cooked',delivery_method:'pickup'},'delivered'),true);
assert.equal(batchEligible(order,'delivered'),false);
assert.equal(batchEligible({...order,status:'delivered'},'delivered'),false);
const selected=[{id:12,version:order.updated_at},{id:15,version:order.updated_at}];
const good={updated:[{id:15,status:'cooked',updated_at:order.updated_at},{id:12,status:'cooked',updated_at:order.updated_at}]};
assert.equal(validateBatchResult(good,selected,'cooked').length,2);
for(const bad of [{}, {updated:[]}, {updated:[good.updated[0],good.updated[0]]}, {updated:[good.updated[0],{...good.updated[1],status:'delivered'}]}, {updated:[good.updated[0],{...good.updated[1],updated_at:null}]}]){
 assert.throws(()=>validateBatchResult(bad,selected,'cooked'));
}
console.log('Grouped order progress: eligible actual stages, pickup, valid preparation, versioned selections and strict results passed.');
