import assert from 'node:assert/strict';
import {receiptStatus,validSimpleQuote,validReceiptUpdate} from './simpleOrdering.js';
// Planned time, payment or a legacy cooking state cannot establish actual receipt.
for(const status of ['pending','processing','cooked','shipped','cancelled'])assert.equal(receiptStatus({status,payment_status:'paid',delivery_at:'2000-01-01T10:00:00Z'}),'not_received');
assert.equal(receiptStatus({status:'delivered',payment_status:'unpaid'}),'received');
const quote={ordering_mode:'simple',needs_review:false,preparation_at:null,preparation_end_at:null,stock_deduction_stage:'placement',tasks:[]};
assert.equal(validSimpleQuote(quote),true);
for(const bad of [null,{}, {...quote,needs_review:true},{...quote,tasks:[{}]},{...quote,preparation_at:'2026-11-01T09:00:00Z'},{...quote,stock_deduction_stage:'cooking'}])assert.equal(validSimpleQuote(bad),false);
const response={updated:[{id:1,status:'delivered',updated_at:'2026-11-01T09:00:00Z'}]};
assert.equal(validReceiptUpdate(response,[1],true),true);
for(const bad of [{}, {updated:[]},{updated:[...response.updated,...response.updated]},{updated:[{...response.updated[0],id:2}]},{updated:[{...response.updated[0],status:'pending'}]}])assert.equal(validReceiptUpdate(bad,[1],true),false);
console.log('Simple ordering: receipt facts, stock-only quotes and exact confirmation identities passed.');
