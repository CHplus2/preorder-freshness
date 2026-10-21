import {invalidResponse} from './apiResponse.js';

export const addressFields=['recipient_name','phone','line1','line2','city','state','postal_code','country'];
export const emptyAddress=Object.fromEntries(addressFields.map(key=>[key,key==='country'?'Malaysia':'']));

export function accountDetails(data,address=false,allowEmpty=false) {
  // DRF's Response(None) is an empty HTTP body, which Axios reads as ''.
  if(address && allowEmpty && (data===null || data===''))return {...emptyAddress};
  const keys=address?addressFields:['username','first_name','last_name'];
  if(!data || Array.isArray(data) || !keys.every(key=>typeof data[key]==='string'))throw invalidResponse();
  return Object.fromEntries(keys.map(key=>[key,data[key]]));
}

export const isPastOrder=order=>['delivered','cancelled'].includes(order.status);
export function customerOrderGroups(orders) {
  // Unknown statuses stay visible in current orders so they cannot silently disappear.
  const recent=[...orders].sort((a,b)=>b.id-a.id);
  return {current:recent.filter(order=>!isPastOrder(order)),history:recent.filter(isPastOrder),all:recent};
}

export function customerDelivery(value) {
  if(typeof value!=='string' || !value.trim() || !Number.isFinite(Date.parse(value)))return 'Contact the kitchen to arrange';
  return new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value))+' (Malaysia)';
}
