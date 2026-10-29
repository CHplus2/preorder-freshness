import assert from 'node:assert/strict';
import {orderHistoryPage} from './orderHistory.js';
const rows=Array.from({length:10},(_,i)=>({id:20-i,status:'pending',items:[]}));
const page={view:'current',counts:{all:20,current:12,history:8},count:12,results:rows,next_before:11};
assert.equal(orderHistoryPage(page).nextBefore,11);
assert.equal(orderHistoryPage({...page,results:rows.slice(0,2),next_before:null}).rows.length,2);
assert.equal(orderHistoryPage({...page,results:[],next_before:null},'current',1).rows.length,0);
for(const change of [{results:[rows[0],rows[0]]},{results:[...rows].reverse()},
 {counts:{all:20,current:12,history:-8}},{count:99},{next_before:10},{next_before:'11'},
 {results:Array.from({length:11},(_,i)=>({id:30-i,status:'pending',items:[]}))},
 {results:[{id:1,status:'delivered',items:[]}]},{results:[{id:1,status:'pending'}]},
 {counts:{all:20,current:11,history:8}},{view:'history'}])assert.throws(()=>orderHistoryPage({...page,...change}),{code:'INVALID_RESPONSE'});
assert.throws(()=>orderHistoryPage(page,'history'),{code:'INVALID_RESPONSE'});
assert.throws(()=>orderHistoryPage(page,'current',20),{code:'INVALID_RESPONSE'});
assert.throws(()=>orderHistoryPage({...page,view:'all',count:20},'auto'),{code:'INVALID_RESPONSE'});
console.log('Order history: private-page metadata, stable descending cursors, bounded rows and malformed/stale filters passed.');
