import {invalidResponse} from './apiResponse.js';
const money=value=>typeof value==='string' && /^\d+\.\d{2}$/.test(value);
const positive=value=>Number.isInteger(value) && value>0;
const totals=value=>value && ['subtotal','discount','shipping','total'].every(k=>money(value[k])) && Number.isInteger(value.quantity) && value.quantity>=0;
export function shoppingSuggestions(data){
 if(!data || !['guided','ai','guided_fallback','owner_review'].includes(data.mode) || !data.draft || !Array.isArray(data.missing) || data.missing.some(k=>!['portions','date'].includes(k)) || !Array.isArray(data.results) || data.results.length>3 || typeof data.basket_known!=='boolean' || (data.basket_total!==null && !totals(data.basket_total)))throw invalidResponse();
 for(const row of data.results)if(!positive(row.id) || typeof row.name!=='string' || !positive(row.quantity) || !money(row.price) || !money(row.addition_subtotal) || !totals(row.basket_after) || typeof row.delivery_day_allowed!=='boolean')throw invalidResponse();
 if(data.draft.portions!==undefined && !positive(data.draft.portions))throw invalidResponse();
 if(data.draft.date!==undefined && !/^\d{4}-\d{2}-\d{2}$/.test(data.draft.date))throw invalidResponse();
 if(data.draft.budget!==undefined && !money(data.draft.budget))throw invalidResponse();
 if(data.draft.search!==undefined && typeof data.draft.search!=='string')throw invalidResponse();
 return data;
}
function addition(data){
 if(!data || !positive(data.product_id) || typeof data.menu!=='string' || !positive(data.quantity) || !Number.isInteger(data.quantity_before) || data.quantity_before<0 || data.quantity_after!==data.quantity_before+data.quantity || !money(data.unit_price) || !totals(data.basket_after) || (data.basket_before!==null && !totals(data.basket_before)))throw invalidResponse();
 return data;
}
export function shoppingPreview(data){
 if(typeof data?.confirm!=='string' || !data.confirm)throw invalidResponse();
 addition(data.preview);return data;
}
export function shoppingAdded(data,expected){
 if(data?.added!==true || typeof data.already_applied!=='boolean' || typeof data.basket_changed!=='boolean')throw invalidResponse();
 addition(data.result);
 if(data.result.product_id!==expected.product_id || data.result.quantity!==expected.quantity || data.result.quantity_after!==expected.quantity_after || data.result.basket_after.total!==expected.basket_after.total)throw invalidResponse();
 return data;
}
