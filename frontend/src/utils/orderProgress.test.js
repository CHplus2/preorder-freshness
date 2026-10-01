import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderProgress,orderStages} from './orderProgress.js';
test('each recorded status has exactly one current stage',()=>{
 for(const [status] of orderStages){const p=orderProgress(status);assert.equal(p.stages.filter(s=>s.state==='current').length,1);assert.equal(p.stages[p.index].key,status);assert.equal(p.stages.filter(s=>s.state==='complete').length,p.index);}
});
test('cancelled and unknown statuses do not invent completed stages',()=>{
 assert.deepEqual(orderProgress('cancelled').stages,[]);assert.equal(orderProgress('cancelled').label,'Cancelled');
 assert.deepEqual(orderProgress('unexpected').stages,[]);
});
