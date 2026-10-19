const invalid=()=>{const error=new Error('Unexpected PayPal payment response');error.code='INVALID_RESPONSE';throw error;};
export function paypalConfig(data){
 if(!data || typeof data.enabled!=='boolean' || data.sandbox!==true || data.currency!=='MYR' || typeof data.client_id!=='string' || (data.enabled && !data.client_id))return invalid();
 return data;
}
export function paypalStatus(data,orderId){
 const states=['not_started','creating','created','approved','completed','pending','uncertain','review_required'];
 if(!data || data.order_id!==orderId || !['pending','processing','cooked','shipped','delivered','cancelled'].includes(data.order_status) || data.sandbox!==true || data.currency!=='MYR' || !/^\d+\.\d{2}$/.test(data.amount) || !['unpaid','paid','refunded'].includes(data.payment_status) || !states.includes(data.state) || typeof data.can_pay!=='boolean' || typeof data.configured!=='boolean' || typeof data.reason!=='string')return invalid();
 if(data.paypal_order_id!=null && !/^[A-Za-z0-9]{1,100}$/.test(data.paypal_order_id))return invalid();
 if(data.capture_id!=null && !/^[A-Za-z0-9]{1,100}$/.test(data.capture_id))return invalid();
 if(data.state==='completed' && (!data.capture_id || !['paid','refunded'].includes(data.payment_status)))return invalid();
 return data;
}
export function paypalRecovery(data){
 if(data==null)return null;
 const states=['not_started','creating','created','approved','completed','pending','uncertain','review_required'];
 if(typeof data.configured!=='boolean' || typeof data.has_provider_order!=='boolean' || !states.includes(data.state))return invalid();
 if(data.checked_at!=null && (typeof data.checked_at!=='string' || !Number.isFinite(Date.parse(data.checked_at))))return invalid();
 if(data.checked_via!=null && !['owner','notification'].includes(data.checked_via))return invalid();
 if(data.check_error!=null && typeof data.check_error!=='string')return invalid();
 return data;
}
