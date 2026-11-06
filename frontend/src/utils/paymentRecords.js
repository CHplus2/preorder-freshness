import {invalidResponse} from './apiResponse.js';

export const paymentStatusLabel=value=>({unpaid:'Not recorded',paid:'Paid',refunded:'Refunded'}[value]||value);
export const paymentMethodLabel=value=>({manual:'Bank QR / transfer',cod:'Cash',paypal:'PayPal',escrow:'Escrow',wallet:'Credit wallet',deferred:'Payment not chosen'}[value]||'Earlier payment method');
export const paymentEventLabel=event=>event.kind==='receipt'?'Payment received':event.outcome==='completed'?'Refund recorded':event.outcome==='pending'?'Refund pending':'Refund failed';

const amount=value=>typeof value==='string'&&/^\d+(\.\d{1,2})?$/.test(value)&&Number.isFinite(Number(value));
export function readPaymentRecords(data){
 if(!data||!Array.isArray(data.events)||!['unpaid','paid','refunded'].includes(data.payment_status)||!amount(data.amount)||typeof data.policy!=='string')throw invalidResponse();
 const ids=new Set();
 for(const event of data.events){
  if(!Number.isInteger(event?.id)||event.id<1||ids.has(event.id)||!['receipt','refund'].includes(event.kind)||!['completed','pending','failed'].includes(event.outcome)||!amount(event.amount)||typeof event.reference!=='string'||typeof event.note!=='string'||typeof event.method!=='string'||typeof event.source!=='string'||typeof event.created_at!=='string'||!Number.isFinite(Date.parse(event.created_at))||event.actor!=null&&(!Number.isInteger(event.actor)||event.actor<1)||event.kind==='receipt'&&event.outcome!=='completed')throw invalidResponse();
  ids.add(event.id);
 }
 if(data.unresolved_refund!=null&&!data.events.some(event=>event.id===data.unresolved_refund&&event.kind==='refund'&&event.outcome==='pending'))throw invalidResponse();
 return data;
}
