import {invalidResponse} from './apiResponse.js';
const email=value=>typeof value==='string' && value.length<=254 && !/[\r\n]/.test(value);
export function orderEmailContact(data){
 if(!data || !email(data.email) || typeof data.available!=='boolean')throw invalidResponse();
 return {email:data.email,available:data.available};
}
export function orderEmailPreference(data){
 if(data?.time_updates!==undefined && typeof data.time_updates!=='boolean')throw invalidResponse();
 if(data?.dispatch_updates!==undefined && typeof data.dispatch_updates!=='boolean')throw invalidResponse();
 if(!data || typeof data.enabled!=='boolean' || !email(data.email) || (data.enabled && !data.email))throw invalidResponse();
 return {enabled:data.enabled,email:data.email,dispatch_updates:data.dispatch_updates===true,time_updates:data.time_updates===true};
}
