import assert from 'node:assert/strict';
import {validReportDay,dailyOrdersUrl,orderCustomerName,undatedOpenOrder,earlierPayment,matchesOrderSearch,receiptView,receiptCounts,sortOrders} from './operationalOrders.js';
for(const day of ['2026-11-05','2024-02-29'])assert.equal(validReportDay(day),true);
for(const day of ['2026-02-30','2025-02-29','2026-13-01','0000-01-01','x&day=1',null])assert.equal(validReportDay(day),false);
assert.equal(dailyOrdersUrl('2026-11-05'),'/admin/orders?view=daily&date=2026-11-05');
assert.equal(dailyOrdersUrl('malformed'),'/admin/orders?view=daily');
assert.equal(orderCustomerName({fulfilment_snapshot:{customer:{name:'Accepted name'}},user:{username:'opaque'}}),'Accepted name');
assert.equal(orderCustomerName({address:{recipient_name:'Earlier recipient'}}),'Earlier recipient');
assert.equal(undatedOpenOrder({delivery_at:null,status:'pending'}),true);
assert.equal(undatedOpenOrder({delivery_at:null,status:'delivered'}),false);
assert.equal(undatedOpenOrder({delivery_at:'2026-11-05T00:00:00Z',status:'pending'}),false);
assert.equal(earlierPayment({payment_method:'manual'}),null);
assert.equal(earlierPayment({payment_method:'constructor'}),null);
assert.match(earlierPayment({payment_method:'paypal'}).note,/test funds/);
console.log('Operational orders: calendar dates, accepted identity, missing dates and factual earlier payments passed.');

const row={id:3,items:[],fulfilment_snapshot:{customer:{name:'Accepted name',phone:'+60123456789'}}};
assert.equal(matchesOrderSearch(row,'ORD-00003','ORD-00003'),true);
assert.equal(matchesOrderSearch({...row,id:30},'ORD-00003','ORD-00030'),false);
assert.equal(matchesOrderSearch({...row,id:1},'ORD-00003','ORD-00001'),false);
assert.equal(matchesOrderSearch(row,'Accepted','ORD-00003'),true);

const history=Array.from({length:158},(_,index)=>({id:index+1,status:index<2?'pending':index<152?'delivered':'cancelled'}));
assert.deepEqual(receiptCounts(history),{all:158,not_received:2,received:150,cancelled:6});
assert.equal(receiptView({status:'processing'}),'not_received');
assert.equal(receiptCounts([]).all,0);
assert.equal(history.filter(order=>receiptView(order)==='not_received').length,2);
assert.equal(history.length,158);

const dated=[
 {id:1,delivery_at:'2026-11-06T00:00:00Z',created_at:'2026-11-03T01:00:00Z'},
 {id:2,delivery_at:null,created_at:'2026-11-04T00:00:00Z'},
 {id:3,delivery_at:'2026-11-07T00:00:00Z',created_at:'2026-11-02T00:00:00Z'},
 {id:4,delivery_at:'2026-11-06T08:00:00+08:00',created_at:'2026-11-01T00:00:00Z'},
];
const ids=rows=>rows.map(order=>order.id);
assert.deepEqual(ids(sortOrders(dated,'delivery_asc')),[1,4,3,2]);
assert.deepEqual(ids(sortOrders(dated,'delivery_desc')),[3,4,1,2]);
assert.deepEqual(ids(sortOrders(dated,'placed_desc')),[2,1,3,4]);
assert.deepEqual(ids(sortOrders(dated,'placed_asc')),[4,3,1,2]);
assert.deepEqual(ids(sortOrders(dated,'unknown')),[1,4,3,2]);
assert.deepEqual(ids(dated),[1,2,3,4]);
assert.deepEqual(ids(sortOrders([{id:5,delivery_at:'invalid'},dated[0]],'delivery_desc')),[1,5]);
