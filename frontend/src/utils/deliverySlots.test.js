import test from 'node:test';
import assert from 'node:assert/strict';
import {basketSlotResult,deliveryInput,followingSearchDay,basketAvailabilityKey} from './deliverySlots.js';

const result={slots:[{delivery_at:'2026-10-21T15:00:00+08:00'}],suggested_date:'2026-10-21',searched_from:'2026-10-20',searched_through:'2026-10-21'};
test('suggested time retains Malaysia wall time and checked date range',()=>{
 const parsed=basketSlotResult(result);
 assert.equal(deliveryInput(parsed.slots[0].delivery_at),'2026-10-21T15:00');
 assert.equal(deliveryInput('2026-10-21T07:00:00Z'),'2026-10-21T15:00');
 assert.equal(parsed.date,'2026-10-21');assert.equal(parsed.from,'2026-10-20');
});
test('malformed, mixed-day or duplicate suggestions are errors, not unavailable days',()=>{
 for(const data of [{slots:null},{...result,suggested_date:'2026-02-30'},
  {...result,slots:[...result.slots,...result.slots]},
  {...result,suggested_date:'2026-10-22'},
  {...result,searched_from:'2026-10-22'},
  {...result,searched_through:'2026-10-20'},
  {...result,searched_from:null,searched_through:null}]) {
  assert.throws(()=>basketSlotResult(data),error=>error.code==='INVALID_RESPONSE');
 }
});
test('structural basket issue has no invented search range or suggestions',()=>{
 const parsed=basketSlotResult({slots:[],suggested_date:null,searched_from:null,searched_through:null,unavailable_code:'quantity_limit',unavailable_reason:'12 requested; daily limit 10.'});
 assert.equal(parsed.code,'quantity_limit');assert.equal(followingSearchDay(parsed),'');
 assert.equal(parsed.slots.length,0);
});
test('following-week action begins after the last checked day including month boundaries',()=>{
 assert.equal(followingSearchDay({through:'2026-10-31'}),'2026-11-01');
 assert.equal(followingSearchDay({through:'2028-02-28'}),'2028-02-29');
 assert.equal(followingSearchDay({through:'not-a-day'}),'');
});
test('basket availability invalidates on quantities and preparation settings',()=>{
 const rows=[{id:1,quantity:1,product:{lead_hours:24,delivery_weekdays:[0],preparation_tasks:[{minutes:30}]}}];
 const original=basketAvailabilityKey(rows);
 assert.notEqual(basketAvailabilityKey([{...rows[0],quantity:2}]),original);
 assert.notEqual(basketAvailabilityKey([{...rows[0],product:{...rows[0].product,lead_hours:48}}]),original);
 assert.notEqual(basketAvailabilityKey([{...rows[0],product:{...rows[0].product,preparation_tasks:[{minutes:60}]}}]),original);
});
