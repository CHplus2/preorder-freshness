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
