import {basketAvailabilityKey,deliveryInput} from './deliverySlots.js';
import {fulfilmentKey} from './fulfilment.js';

export const DELIVERY_CHOICE_KEY='basketDeliveryChoice';
export function chosenDeliveryInput(value,now=Date.now()){
 if(typeof value!=='string')return '';
 const local=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
 const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
 if(!local && !iso)return '';
 const day=value.slice(0,10),clock=value.slice(11,19),stamp=Date.parse(local?value+':00+08:00':value);
 if(!Number.isFinite(stamp) || stamp<=now || new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day
  || Number(clock.slice(0,2))>23 || Number(clock.slice(3,5))>59 || (iso && Number(clock.slice(6,8))>59))return '';
 return deliveryInput(new Date(stamp).toISOString());
}
export const deliveryChoiceScope=(account,cart,store,method,area,minutes)=>JSON.stringify([account,
 basketAvailabilityKey([...cart].sort((a,b)=>a.id-b.id)),fulfilmentKey(store,method,area,minutes)]);
export function activeDeliveryChoice(record,scope,now=Date.now()){
 return record?.version===1 && record.scope===scope?chosenDeliveryInput(record.value,now):'';
}
export function readDeliveryChoice(storage){
 try{const value=JSON.parse(storage.getItem(DELIVERY_CHOICE_KEY));return value?.version===1 && typeof value.scope==='string' && chosenDeliveryInput(value.value)?value:null;}catch{return null;}
}
export function saveDeliveryChoice(storage,record){
 try{if(record)storage.setItem(DELIVERY_CHOICE_KEY,JSON.stringify(record));else storage.removeItem(DELIVERY_CHOICE_KEY);storage.removeItem('preferredDelivery');}catch{/* In-memory choices still work when browser storage is blocked. */}
}
