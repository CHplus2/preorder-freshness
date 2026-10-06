import assert from 'node:assert/strict';
import {guideResponse, rememberSuggestion} from './guideResponse.js';
const row={id:1,name:'Rice',portions:2,food_total:'24.00',reasons:['Within budget'],slots:[{delivery_at:'2026-10-10T15:00:00+08:00'}]};
const response={session:'test-session',message:'Suggestions only',results:[row]};
assert.equal(guideResponse(response),response);
assert.deepEqual(guideResponse({...response,results:[]}).results,[]);
for(const bad of [null,{}, {...response,results:null}, ...[
  {food_total:null},{food_total:''},{food_total:'invalid'},{portions:0},{reasons:[null]},
  {slots:[]},{slots:[{delivery_at:'invalid'}]}
].map(change=>({...response,results:[{...row,...change}]}))]) {
  assert.throws(()=>guideResponse(bad),error=>error.code==='INVALID_RESPONSE');
}
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw new Error('Storage blocked');}});
assert.doesNotThrow(()=>rememberSuggestion('preferredDelivery','date'));
delete globalThis.sessionStorage;
console.log('Guide response validation and optional storage recovery passed.');
