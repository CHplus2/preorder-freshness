import {invalidResponse} from './apiResponse.js';
import {orderEmailContact} from './orderEmail.js';
export function emailChangeSettings(data){
 const contact=orderEmailContact(data);
 for(const key of ['email_change_confirmation_required','email_change_available','email_change_pending'])if(data[key]!==undefined && typeof data[key]!=='boolean')throw invalidResponse();
 return {...contact,confirmationRequired:data.email_change_confirmation_required===true,confirmationAvailable:data.email_change_available===true,pending:data.email_change_pending===true};
}
export function emailChangePreview(data){
 if(!data || ![data.current_email,data.proposed_email].every(value=>typeof value==='string' && value.length<=254 && !/[\r\n]/.test(value)) || !data.proposed_email || typeof data.already_applied!=='boolean')throw invalidResponse();
 return data;
}
export function emailChangeToken(hash=''){
 const values=new URLSearchParams(hash.replace(/^#/,''));const token=values.get('token');
 return values.getAll('token').length===1 && token && token.length<=4096?token:'';
}
