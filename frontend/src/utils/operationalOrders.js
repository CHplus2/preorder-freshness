import {malaysiaDay} from './clientReports.js';
export function validReportDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<1)return false;
 const stamp=Date.parse(value+'T12:00:00Z');
 return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value;
}
export const dailyOrdersUrl=day=>'/admin/orders?view=daily'+(validReportDay(day)?'&date='+day:'');
export const summaryDay=value=>validReportDay(value)?value:malaysiaDay();
export const orderCustomerName=order=>order.fulfilment_snapshot?.customer?.name||order.address?.recipient_name||order.delivery_address?.recipient_name||order.user?.username||'Name not recorded';
export const undatedOpenOrder=order=>!order.delivery_at&&!['delivered','cancelled'].includes(order.status);
export const receiptView=order=>order.status==='cancelled'?'cancelled':order.status==='delivered'?'received':'not_received';
export const receiptCounts=orders=>orders.reduce((counts,order)=>{
 counts.all+=1;counts[receiptView(order)]+=1;return counts;
},{all:0,not_received:0,received:0,cancelled:0});
export const orderSortOptions=[
 {value:'delivery_asc',label:'Delivery date: earliest first'},
 {value:'delivery_desc',label:'Delivery date: latest first'},
 {value:'placed_desc',label:'Order placed: newest first'},
 {value:'placed_asc',label:'Order placed: oldest first'},
];
export function sortOrders(orders,sort='delivery_asc'){
 const choice=orderSortOptions.some(option=>option.value===sort)?sort:'delivery_asc';
 const field=choice.startsWith('delivery_')?'delivery_at':'created_at',direction=choice.endsWith('_desc')?-1:1;
 return [...orders].sort((a,b)=>{
  const first=a[field]?Date.parse(a[field]):NaN,last=b[field]?Date.parse(b[field]):NaN;
  if(!Number.isFinite(first)||!Number.isFinite(last)){
   if(Number.isFinite(first))return -1;
   if(Number.isFinite(last))return 1;
   return direction*(a.id-b.id);
  }
  return direction*(first-last||a.id-b.id);
 });
}
const earlierMethods={paypal:{label:'PayPal Sandbox',note:'This used test funds; no real money was transferred.'},
  escrow:{label:'Escrow · Sepolia',note:'This used test cryptocurrency; it is not a bank payment.'},
  wallet:{label:'Credit wallet',note:'This used test credits; it is not a bank payment.'},
  synthetic_demo:{label:'Generated history',note:'This is not a customer payment.'},
  deferred:{label:'Unconfirmed payment request',note:'This used the earlier payment-request workflow.'}};
export const earlierPayment=order=>Object.hasOwn(earlierMethods,order.payment_method)?earlierMethods[order.payment_method]:null;


export function matchesOrderSearch(order,search,formattedReference){
 const text=String(search).trim(),reference=/^#?ORD-(\d+)$/i.exec(text);
 if(reference)return Number(reference[1])===order.id;
 const term=text.toLocaleLowerCase();
 return !term||[String(order.id),formattedReference,orderCustomerName(order),order.fulfilment_snapshot?.customer?.phone,order.address?.recipient_name,order.user?.username,...order.items.map(item=>item.product_name)].filter(Boolean).some(value=>String(value).toLocaleLowerCase().includes(term));
}
