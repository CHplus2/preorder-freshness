import {invalidResponse} from './apiResponse.js';
import {customerDelivery} from './customerExperience.js';
const valid=value=>typeof value==='string' && Number.isFinite(Date.parse(value));
export function readArrivalWindow(value,deadline){
 if(value==null)return null;
 if(![30,60].includes(value.minutes) || !valid(value.start) || !valid(value.end)
  || Date.parse(value.end)-Date.parse(value.start)!==value.minutes*60000
  || (deadline && Date.parse(value.end)!==Date.parse(deadline)))throw invalidResponse();
 const day=stamp=>new Date(Date.parse(stamp)+8*3600000).toISOString().slice(0,10);
 if(day(value.start)!==day(value.end))throw invalidResponse();
 return value;
}
export function makeArrivalWindow(deadline,minutes){
 if(!minutes || !valid(deadline) || ![30,60].includes(minutes))return null;
 return {start:new Date(Date.parse(deadline)-minutes*60000).toISOString(),end:deadline,minutes};
}
export const arrivalMinutes=order=>order?.arrival_window?.minutes ?? order?.fulfilment_snapshot?.arrival_window_minutes ?? 0;
const time=value=>new Date(value).toLocaleTimeString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'numeric',minute:'2-digit'});
export function orderWindow(order){
 return readArrivalWindow(order?.arrival_window ?? makeArrivalWindow(order?.delivery_at,arrivalMinutes(order)),order?.delivery_at);
}
export function arrivalLabel(order){
 try{
  const value=orderWindow(order);
  if(!value)return customerDelivery(order?.delivery_at);
  const date=new Date(value.start).toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric'});
  return `${date}, ${time(value.start)}–${time(value.end)} (Malaysia)`;
 }catch{return 'Arrival details need kitchen review';}
}
export function slotLabel(slot){
 const value=readArrivalWindow(slot.arrival_window,slot.delivery_at);
 return value?`${time(value.start)}–${time(value.end)}`:time(slot.delivery_at);
}
export const arrivalStart=order=>orderWindow(order)?.start || order.delivery_at;
