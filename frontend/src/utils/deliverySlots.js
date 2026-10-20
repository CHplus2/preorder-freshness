import {invalidResponse,responseSlots} from './apiResponse.js';

export const deliveryInput=value=>new Date(Date.parse(value)+8*3600000).toISOString().slice(0,16);
export const deliveryDateLabel=value=>new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',weekday:'short',day:'numeric',month:'short',year:'numeric'});
const validDay=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;

export function basketSlotResult(data) {
 const slots=responseSlots(data);
 if(slots.length>13 || new Set(slots.map(s=>Date.parse(s.delivery_at))).size!==slots.length)throw invalidResponse();
 const date=data.suggested_date,from=data.searched_from,through=data.searched_through;
 if(slots.length && (!validDay(date) || slots.some(s=>deliveryInput(s.delivery_at).slice(0,10)!==date)))throw invalidResponse();
 if((from!=null || through!=null) && (!validDay(from) || !validDay(through) || from>through))throw invalidResponse();
 if(slots.length && (!from || !through || date<from || date>through))throw invalidResponse();
 return {slots,date:date || '',from:from || '',through:through || '',
  code:typeof data.unavailable_code==='string'?data.unavailable_code:'',
  reason:typeof data.unavailable_reason==='string'?data.unavailable_reason:''};
}

export function followingSearchDay(result) {
 if(!validDay(result?.through))return '';
 return new Date(Date.parse(result.through+'T12:00:00Z')+86400000).toISOString().slice(0,10);
}

export const basketAvailabilityKey=cart=>JSON.stringify(cart.map(i=>[i.id,i.quantity,
 i.product.updated_at,i.product.delivery_weekdays,i.product.lead_hours,i.product.daily_capacity,
 i.product.max_early_minutes,i.product.max_preparation_days,i.product.preparation_tasks]));
