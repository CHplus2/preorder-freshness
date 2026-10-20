import {invalidResponse} from './apiResponse.js';
export function walletBalance(data){
 if(!data || typeof data.balance!=='number' || !Number.isFinite(data.balance) || data.balance<0 || data.balance>=100000000)throw invalidResponse();
 if(data.already_applied!=null && typeof data.already_applied!=='boolean')throw invalidResponse();
 return data.balance;
}
export function walletData(data){
 walletBalance(data);
 if(!Number.isSafeInteger(data.id) || data.id<1 || typeof data.wallet_address!=='string' || !data.wallet_address || data.wallet_address.length>255)throw invalidResponse();
 return data;
}
