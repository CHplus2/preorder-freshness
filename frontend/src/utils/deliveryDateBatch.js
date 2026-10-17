import {invalidResponse} from './apiResponse.js';
const id=value=>Number.isInteger(value) && value>0;
const unique=rows=>new Set(rows).size===rows.length;
export function deliveryDatePreview(data){
 if(data?.mode!=='preview' || typeof data.confirm!=='string' || !data.confirm.trim() || typeof data.note!=='string'
  || !Array.isArray(data.proposed_dates) || !Array.isArray(data.skipped))throw invalidResponse();
 for(const row of data.proposed_dates){
  if(!id(row?.order_id) || typeof row.delivery_at!=='string' || !Number.isFinite(Date.parse(row.delivery_at))
   || !['unpaid','paid','refunded'].includes(row.payment_status) || !Array.isArray(row.menus) || !row.menus.length
   || row.menus.some(menu=>typeof menu?.name!=='string' || !menu.name.trim() || !id(menu.quantity)))throw invalidResponse();
 }
 for(const row of data.skipped)if(!id(row?.order_id) || typeof row.reason!=='string')throw invalidResponse();
 if(!unique([...data.proposed_dates,...data.skipped].map(row=>row.order_id)))throw invalidResponse();
 return data;
}
export function deliveryDateConfirmation(data,expectedIds){
 if(data?.mode!=='applied' || typeof data.already_applied!=='boolean' || !Array.isArray(data.updated_order_ids)
  || data.updated_order_ids.some(value=>!id(value)) || !unique(data.updated_order_ids)
  || !Number.isInteger(data.remaining_missing_dates) || data.remaining_missing_dates<0
  || data.updated_order_ids.length!==expectedIds.length || expectedIds.some(value=>!data.updated_order_ids.includes(value)))throw invalidResponse();
 return data;
}
