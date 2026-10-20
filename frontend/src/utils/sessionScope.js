import {invalidResponse} from './apiResponse.js';

export const SESSION_SIGNAL='dk-session-change';
const MARKER='dk-account-scope';
const sessionKeys=['checkoutAttempt','deliveryPlan','preferredDelivery','recommendationSession','walletTopupAttempt'];
export function authSession(data){
 if(!data || typeof data.authenticated!=='boolean')throw invalidResponse();
 if(!data.authenticated)return {isAuthenticated:false,isAdmin:false,accountKey:'anonymous'};
 if(typeof data.username!=='string' || !data.username || typeof data.is_admin!=='boolean' || (data.user_id!=null && (!Number.isSafeInteger(data.user_id) || data.user_id<1)))throw invalidResponse();
 return {isAuthenticated:true,isAdmin:data.is_admin,accountKey:`user:${data.user_id ?? data.username}:${data.is_admin?'staff':'customer'}`};
}
export function scopeStorage(storage,accountKey,keys=sessionKeys){
 try{
  if(storage.getItem(MARKER)!==accountKey){for(const key of keys)storage.removeItem(key);storage.setItem(MARKER,accountKey);}
 }catch{/* Account changes still clear in-memory state if browser storage is blocked. */}
}
export function syncBrowserScope(accountKey){
 try{scopeStorage(sessionStorage,accountKey)}catch{/* Browser storage may be disabled. */}
 try{scopeStorage(localStorage,accountKey,['addressId'])}catch{/* No private storage is required to sign in. */}
}
export function announceSessionChange(){try{localStorage.setItem(SESSION_SIGNAL,crypto.randomUUID())}catch{/* Focus also rechecks the session. */}}
export function accountChanged(){const error=new Error('Your account changed. Review the current account before continuing.');error.code='ACCOUNT_CHANGED';return error;}
