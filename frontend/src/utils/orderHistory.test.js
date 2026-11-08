import assert from 'node:assert/strict';
import {orderHistoryPage,orderHistoryReducer} from './orderHistory.js';
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
const loaded=orderHistoryReducer({rows:[],page:null},{type:'loaded',page:orderHistoryPage(page)});
const cancelled={...rows[0],status:'cancelled',updated_at:'2026-11-08T12:00:00Z'};
const confirmed=orderHistoryReducer(loaded,{type:'cancelled',order:cancelled});
assert.equal(confirmed.rows[0],cancelled);
assert.deepEqual(confirmed.page.counts,{all:20,current:11,history:9});
assert.equal(confirmed.page.count,11);
assert.equal(confirmed.page.nextBefore,11); // Cancellation never resets a pagination cursor.
assert.equal(rows[0].status,'pending');
assert.deepEqual(orderHistoryReducer(confirmed,{type:'cancelled',order:cancelled}).page.counts,confirmed.page.counts);
assert.equal(orderHistoryReducer(confirmed,{type:'cancelled',order:{...cancelled,id:999}}),confirmed);
const all=orderHistoryReducer({rows:loaded.rows,page:{...loaded.page,view:'all',count:20}},
 {type:'cancelled',order:cancelled});
assert.equal(all.page.count,20);assert.equal(all.rows[0].status,'cancelled');
const history=orderHistoryReducer(confirmed,{type:'view',view:'history'});
assert.deepEqual(history.rows,[]);assert.equal(history.page.count,9);
const appended=orderHistoryReducer(confirmed,{type:'loaded',append:true,
 page:{...confirmed.page,rows:[confirmed.rows[9],{id:10,status:'pending',items:[]}],nextBefore:null}});
assert.equal(appended.rows.length,11);assert.equal(appended.rows[0].status,'cancelled');
console.log('Order history: private-page metadata, stable descending cursors, bounded rows and malformed/stale filters passed.');
