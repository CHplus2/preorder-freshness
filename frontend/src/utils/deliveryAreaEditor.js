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
