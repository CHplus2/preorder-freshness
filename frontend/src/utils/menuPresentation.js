import {invalidResponse} from './apiResponse.js';

const money=value=>(typeof value==='number' || typeof value==='string' && value.trim()!=='') && Number.isFinite(Number(value)) && Number(value)>=0;
const card=value=>value && Number.isInteger(value.id) && value.id>0 && typeof value.name==='string' && value.name.trim()
 && money(value.price) && Number.isInteger(value.lead_hours) && value.lead_hours>=0
 && Number.isInteger(value.daily_capacity) && value.daily_capacity>=0
 && Array.isArray(value.delivery_weekdays) && value.delivery_weekdays.every(d=>Number.isInteger(d) && d>=0 && d<=6);

export function menuPage(data) {
 if(!Array.isArray(data?.results) || data.results.length>12 || !data.results.every(card)
  || new Set(data.results.map(p=>p.id)).size!==data.results.length
  || !Number.isInteger(data.count) || data.count<data.results.length
  || !(data.next===null || typeof data.next==='string' && data.next.trim()))throw invalidResponse();
 return {rows:data.results,count:data.count,next:Boolean(data.next)};
}

export function menuDetail(data,id) {
 if(!card(data) || data.id!==Number(id) || !['active','paused','archived'].includes(data.selling_status)
  || typeof data.description!=='string' || typeof data.image_url!=='string')throw invalidResponse();
 return data;
}

export function kitchenPromotion(store) {
 const percent=store?.bulk_discount_percent,minimum=store?.bulk_minimum;
 return Number.isInteger(percent) && percent>0 && percent<=100 && Number.isInteger(minimum) && minimum>0
  ?{percent,minimum}:null;
}

export const shortDeliveryDays=days=>days?.length?days.map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', '):'';
