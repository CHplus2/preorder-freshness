import {deliveryAreasError} from './deliveryAreas.js';
export const areaFee=(store,name)=>store.delivery_area_fees&&Object.hasOwn(store.delivery_area_fees,name)?store.delivery_area_fees[name]:store.delivery_fee_myr??'5.00';
export function changeDeliveryArea(store,previous,name,fee){
 const nextName=String(name).trim().replace(/\s+/g,' ');
 const areas=[...(store.delivery_areas||[])];
 if(previous!==null&&!areas.includes(previous))throw new Error('This area changed. Reload the saved list before editing.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(String(fee))||!Number.isFinite(Number(fee))||Number(fee)>999999.99)throw new Error('Enter a delivery fee from RM0 to RM999,999.99 with up to two decimal places.');
 const index=previous===null?areas.length:areas.indexOf(previous);areas[index]=nextName;
 const issue=deliveryAreasError(areas);if(issue)throw new Error(issue);
 const fees=Object.fromEntries(Object.entries(store.delivery_area_fees||{}).filter(([key])=>areas.includes(key)&&key!==previous));
 Object.defineProperty(fees,nextName,{value:Number(fee).toFixed(2),enumerable:true,writable:true,configurable:true});
 return {...store,delivery_areas:areas,delivery_area_fees:fees};
}
export function removeDeliveryArea(store,name){
 const areas=(store.delivery_areas||[]).filter(area=>area!==name);
 return {...store,delivery_areas:areas,delivery_area_fees:Object.fromEntries(Object.entries(store.delivery_area_fees||{}).filter(([key])=>areas.includes(key)))};
}
export function deliveryFeeError(store){
 const areaIssue=deliveryAreasError(store.delivery_areas||[]);if(areaIssue)return areaIssue;
 const values=[store.delivery_fee_myr,...Object.values(store.delivery_area_fees||{}),...(store.free_delivery_minimum_myr==null?[]:[store.free_delivery_minimum_myr])];
 if(values.some(value=>!/^\d+(?:\.\d{1,2})?$/.test(String(value))||!Number.isFinite(Number(value))||Number(value)>999999.99))return 'Enter valid delivery fees and a valid free-delivery threshold, or switch free delivery off.';
 return '';
}

// Save one complete delivery section without publishing unrelated draft edits.
export function deliverySettingsPayload(store){
 if(store.delivery_enabled===false)return {delivery_enabled:false};
 const issue=deliveryFeeError(store);if(issue)throw new Error(issue);
 const clock=(value,fallback)=>{
  const text=value??fallback;
  if(typeof text!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(text))throw new Error('Enter valid delivery start and end times.');
  return text.slice(0,5);
 };
 const first=clock(store.delivery_start_time,'07:30'),last=clock(store.delivery_end_time,'11:00');
 if(first>=last)throw new Error('Delivery must end after its start time on the same day.');
 return {delivery_enabled:true,delivery_start_time:first,delivery_end_time:last,
  delivery_areas:[...(store.delivery_areas||[])],
  delivery_area_fees:Object.fromEntries(Object.entries(store.delivery_area_fees||{}).sort(([a],[b])=>a.localeCompare(b)).map(([area,fee])=>[area,Number(fee).toFixed(2)])),
  delivery_fee_myr:Number(store.delivery_fee_myr).toFixed(2),
  free_delivery_minimum_myr:store.free_delivery_minimum_myr==null?null:Number(store.free_delivery_minimum_myr).toFixed(2)};
}
