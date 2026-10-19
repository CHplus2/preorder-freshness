import assert from 'node:assert/strict';
import {deliveryPolicy,deliveryPreview,deliveryConfirmation} from './deliveryResponse.js';

const stamp='2026-11-10T15:00:00+08:00';
const policy={eligible:true,reason:'',cutoff:stamp,history:[]};
const preview={confirm:'signed-token',preview:{previous_delivery:stamp,delivery_at:stamp,change_closes_at:stamp,reason:'Later meal'}};
const confirmed={order:{id:2,delivery_at:stamp},already_applied:false};
assert.equal(deliveryPolicy(policy),policy);
assert.equal(deliveryPreview(preview),preview);
assert.equal(deliveryConfirmation(confirmed,2),confirmed);
assert.doesNotThrow(()=>deliveryPolicy({eligible:false,reason:'Contact kitchen',cutoff:null,history:[]}));
assert.doesNotThrow(()=>deliveryConfirmation({...confirmed,already_applied:true},2));
assert.doesNotThrow(()=>deliveryPolicy({...policy,initial_delivery:true,cutoff:null}));
assert.doesNotThrow(()=>deliveryPolicy({...policy,history:[{id:1,at:stamp,delivery_at:stamp,previous_delivery:null,reason:'First agreed date',by:'owner'}]}));
assert.doesNotThrow(()=>deliveryPreview({...preview,preview:{...preview.preview,previous_delivery:null,needs_review:true}}));
assert.doesNotThrow(()=>deliveryPolicy({...policy,unconfirmed_request:true,cutoff:null}));
assert.doesNotThrow(()=>deliveryPreview({...preview,preview:{...preview.preview,unconfirmed_request:true,needs_review:true,change_closes_at:null}}));
assert.throws(()=>deliveryPolicy({...policy,unconfirmed_request:'true',cutoff:null}),{code:'INVALID_RESPONSE'});
assert.throws(()=>deliveryPreview({...preview,preview:{...preview.preview,unconfirmed_request:true,needs_review:false,change_closes_at:null}}),{code:'INVALID_RESPONSE'});
assert.throws(()=>deliveryPolicy({...policy,cutoff:null}),{code:'INVALID_RESPONSE'});
assert.throws(()=>deliveryPolicy({...policy,initial_delivery:'true',cutoff:null}),{code:'INVALID_RESPONSE'});
for(const value of [null,{},'<html>Service unavailable</html>',{...policy,history:null},{...policy,history:[null]},{...policy,cutoff:'invalid'}]) {
  assert.throws(()=>deliveryPolicy(value),{code:'INVALID_RESPONSE'});
}
for(const value of [null,{}, {...preview,confirm:''},{...preview,preview:null},{...preview,preview:{...preview.preview,delivery_at:'invalid'}}]) {
  assert.throws(()=>deliveryPreview(value),{code:'INVALID_RESPONSE'});
}
for(const value of [null,{}, {order:{id:3,delivery_at:stamp},already_applied:false},{...confirmed,already_applied:'false'},{...confirmed,order:{id:2,delivery_at:'invalid'}}]) {
  assert.throws(()=>deliveryConfirmation(value,2),{code:'INVALID_RESPONSE'});
}
console.log('Delivery policy, preview and confirmation response validation passed.');

const {deliveryDatePreview,deliveryDateConfirmation}=await import('./deliveryDateBatch.js');
const proposed={mode:'preview',confirm:'signed-batch',note:'Fictional requests only',proposed_dates:[{order_id:2,delivery_at:stamp,payment_status:'unpaid',menus:[{name:'Nasi Ayam',quantity:2}]}],skipped:[{order_id:4,reason:'Preparation already started'}]};
assert.equal(deliveryDatePreview(proposed),proposed);
for(const value of [{...proposed,confirm:''},{...proposed,proposed_dates:null},
 {...proposed,proposed_dates:[{...proposed.proposed_dates[0],delivery_at:'not a date'}]},
 {...proposed,proposed_dates:[{...proposed.proposed_dates[0],menus:[{name:'Nasi Ayam',quantity:0}]}]},
 {...proposed,skipped:[{order_id:2,reason:'Same record twice'}]}])assert.throws(()=>deliveryDatePreview(value),{code:'INVALID_RESPONSE'});
const batchSaved={mode:'applied',updated_order_ids:[2],already_applied:false,remaining_missing_dates:1};
assert.equal(deliveryDateConfirmation(batchSaved,[2]),batchSaved);
assert.doesNotThrow(()=>deliveryDateConfirmation({...batchSaved,already_applied:true},[2]));
for(const value of [{...batchSaved,updated_order_ids:[]},{...batchSaved,updated_order_ids:[2,2]},
 {...batchSaved,updated_order_ids:[3]},{...batchSaved,remaining_missing_dates:-1},
 {...batchSaved,already_applied:'false'}])assert.throws(()=>deliveryDateConfirmation(value,[2]),{code:'INVALID_RESPONSE'});
console.log('Batch date preview and exact saved-cohort validation passed.');
