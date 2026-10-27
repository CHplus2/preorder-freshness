import {apiError} from './apiError.js';
import {invalidResponse} from './apiResponse.js';

export function accountRequestError(error,action='signin') {
  if(action==='signin' && error?.response?.status===401)return 'Your email or username and password were not accepted. Check your details. If your email is shared, use your existing username.';
  if(!error?.response || error.response.status>=500 || error.code==='INVALID_RESPONSE') {
    if(action==='logout')return 'Sign-out could not be confirmed. You may still be signed in. Check your connection and try again.';
    if(action==='signup')return 'Account creation could not be confirmed. Try signing in with these details before creating another account.';
    if(action==='reset')return 'The password update could not be confirmed. Try signing in with your new password; request a new reset link if needed.';
    if(action==='recovery')return 'The reset-link request could not be confirmed. Check your email before requesting another link.';
    return 'Sign-in could not be confirmed. Check your connection and try signing in again.';
  }
  return apiError(error,'These details could not be accepted. Review them and try again.');
}

export function accountConfirmation(data) {
  if(typeof data?.detail!=='string' || !data.detail.trim() || /<[^>]+>/.test(data.detail))throw invalidResponse();
  return data.detail;
}

export function resetCredentials(hash='') {
  const params=new URLSearchParams(hash.replace(/^#/,''));
  return {uid:params.get('uid'),token:params.get('token')};
}
