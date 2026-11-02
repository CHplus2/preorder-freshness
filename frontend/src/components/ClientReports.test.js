import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
import {malaysiaDay,dailyReport,periodReport,printableSlip,slipUrl} from '../utils/clientReports.js';

const order={id:12,name:'Buyer <script>alert(1)</script>',phone:'+60123456789',kitchen:'Kitchen & home',
 receipt_status:'not_received',payment_status:'unpaid',payment_method:'manual',delivery_method:'standard',
 delivery_at:'2026-11-03T00:30:00Z',arrival_window:null,food_total:'25.00',delivery_fee:'4.50',discount:'5.00',total:'29.50',
 items:[{id:1,name:'Saved <b>menu</b>',quantity:3,unit_price:'10.00',food_total:'30.00'}],
 address_lines:['Saved street','Kuching'],pickup_location:'Pickup shelf',handover_notes:'Please call',handover_location:'',printed_at:'2026-11-02T03:00:00Z'};
const daily={date:'2026-11-03',page:1,page_size:50,count:1,cancelled_count:0,received_count:0,quantity:3,has_more:false,
 food_total:'25.00',delivery_fee:'4.50',order_value:'29.50',menus:[{product_id:1,product_name:'Saved menu',quantity:3,gross_food:'30.00'}],menus_truncated:false,orders:[order]};
const sales={start:'2026-11-01',end:'2026-11-30',paid_received_orders:1,unpaid_received_orders:0,unscheduled_orders:0,excluded_test_orders:0,
 net_food_sales:'25.00',delivery_income:'4.50',discounts:'5.00',total_sales:'29.50',menus:daily.menus,menus_truncated:false,
 days:[{date:'2026-11-03',net_food_sales:'25.00',delivery_income:'4.50',total_sales:'29.50'}]};
assert.equal(malaysiaDay(new Date('2026-11-02T16:01:00Z')),'2026-11-03');
assert.equal(malaysiaDay(new Date('2026-11-02T15:59:00Z')),'2026-11-02');
assert.equal(slipUrl(12),'/admin/orders/12/print');
assert.equal(dailyReport(daily,'2026-11-03',1),daily);
assert.equal(periodReport(sales,sales.start,sales.end),sales);
assert.equal(printableSlip(order,12),order);
for(const read of [()=>dailyReport(daily,'2026-11-04',1),()=>dailyReport(daily,'2026-11-03',2),
 ()=>dailyReport({...daily,orders:[order,order]},daily.date,1),
 ()=>dailyReport({...daily,orders:[{...order,total:'NaN'}]},daily.date,1),
 ()=>periodReport(sales,'2026-10-01',sales.end),
 ()=>periodReport({...sales,days:[{...sales.days[0],date:'2026-12-01'}]},sales.start,sales.end),
 ()=>printableSlip({...order,id:13},12),()=>printableSlip({...order,address_lines:[{}]},12)]){
 assert.throws(read,{code:'INVALID_RESPONSE'});
}
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {OrderSlip}=await server.ssrLoadModule('/src/pages/admin/OrderPrintPage.jsx');
 const render=props=>renderToStaticMarkup(h(OrderSlip,props));
 const html=render({order});
 assert.match(html,/Customer name \/ Nama/);assert.match(html,/Phone \/ Telefon/);assert.match(html,/Address \/ Alamat/);
 assert.match(html,/Saved street/);assert.match(html,/RM 29\.50/);assert.match(html,/DuitNow QR/);
 assert.match(html,/Payment: unpaid/);assert.match(html,/not proof of payment/);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>|<b>menu<\/b>|email|password|preparation/i);
 const pickup=render({order:{...order,delivery_method:'pickup',address_lines:[]}});
 assert.match(pickup,/Collection location/);assert.match(pickup,/Pickup shelf/);assert.doesNotMatch(pickup,/Saved street/);
 assert.match(render({order:{...order,receipt_status:'cancelled'}}),/Cancelled/);
 const {DailyOrderReport,PeriodSalesReport}=await server.ssrLoadModule('/src/components/ClientReports.jsx');
 const initial=renderToStaticMarkup(h(MemoryRouter,null,h('div',null,h(DailyOrderReport),h(PeriodSalesReport))));
 assert.match(initial,/Daily order summary/);assert.match(initial,/Delivery \/ collection date/);assert.match(initial,/Sales by delivery date/);
 assert.match(initial,/Loading report/);assert.doesNotMatch(initial,/RM 0\.00|Download sales CSV/);
 console.log('Client reports: date/request validation, safe print rendering, accepted totals, pickup details and honest loading states passed.');
}finally{await server.close();}
