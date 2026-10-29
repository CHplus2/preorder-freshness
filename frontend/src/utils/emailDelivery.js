import {invalidResponse} from './apiResponse.js';
const address=value=>value===null || (typeof value==='string' && value.length<=254 && value.includes('@') && !/[\r\n<>]/.test(value));
export function emailDelivery(value){
 if(!value || typeof value.transport_ready!=='boolean' || typeof value.test_available!=='boolean' || !address(value.sender_address) || !address(value.owner_recipient) || value.test_available!==Boolean(value.transport_ready && value.sender_address && value.owner_recipient))throw invalidResponse();
 return value;
}
export function emailCheckResult(value,recipient,status){
 const reasons=['authentication','sender_rejected','recipient_rejected','message_rejected','connection','no_acceptance','unknown'];
 if(!value || !/^FCMAIL-[0-9a-f]{12}$/.test(value.reference) || value.recipient!==recipient || value.retry_after!==300 || !['accepted','not_accepted','unconfirmed'].includes(value.outcome)
  || (value.outcome==='accepted'?(status!==202 || value.reason!==null):(status!==503 || !reasons.includes(value.reason)))
  || (value.outcome==='unconfirmed' && value.reason!=='unknown') || (value.outcome==='not_accepted' && value.reason==='unknown'))throw invalidResponse();
 return value;
}
export const emailCheckReason=reason=>({authentication:'Email sign-in failed. Check your sending account or app password.',sender_rejected:'The sender address was rejected. Use an address approved by your email provider.',recipient_rejected:'Your reminder address was rejected. Check the address in your hosting email settings.',message_rejected:'The provider rejected the message. Review the provider’s mail logs.',connection:'The connection to your email provider failed. Check your hosting email settings.',no_acceptance:'The mail backend did not report an accepted message.',unknown:'The result could not be confirmed. The provider may have accepted it before the connection ended. Check the recipient inbox and provider logs before trying again.'})[reason] || 'The result could not be confirmed.';
