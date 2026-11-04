// Native WebAuthn uses ArrayBuffers; the API exchanges bounded base64url JSON.
import axios from 'axios';
import {getCookie} from './cookieUtils';
export function decodeBase64url(value){
 const raw=atob(value.replaceAll('-','+').replaceAll('_','/'));return Uint8Array.from(raw,c=>c.charCodeAt(0)).buffer;
}
export function encodeBase64url(value){
 return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
export function passkeysSupported(){return typeof window!=='undefined'&&window.isSecureContext&&typeof window.PublicKeyCredential!=='undefined'&&!!navigator.credentials;}
export function credentialJSON(credential){
 if(!credential)throw new Error('No passkey was selected. Please try again.');
 const response={clientDataJSON:encodeBase64url(credential.response.clientDataJSON)};
 for(const field of ['attestationObject','authenticatorData','signature','userHandle']){
  if(credential.response[field])response[field]=encodeBase64url(credential.response[field]);
 }
 return {id:credential.id,rawId:encodeBase64url(credential.rawId),type:credential.type,response,
  clientExtensionResults:credential.getClientExtensionResults()};
}
export function browserOptions(options,register){
 const result={...options,challenge:decodeBase64url(options.challenge)};
 if(register){result.user={...options.user,id:decodeBase64url(options.user.id)};result.excludeCredentials=(options.excludeCredentials||[]).map(k=>({...k,id:decodeBase64url(k.id)}));}
 else result.allowCredentials=(options.allowCredentials||[]).map(k=>({...k,id:decodeBase64url(k.id)}));
 return result;
}
export async function runPasskeyCeremony(action,values={}){
 if(!['register','signin','reauth'].includes(action))throw new Error('Unknown passkey action.');
 if(!passkeysSupported())throw new Error('Use a browser that supports passkeys and open this website over HTTPS.');
 const post=(part,body)=>axios.post(`/api/account/passkeys/${action}/${part}/`,body,{withCredentials:true,timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
 const {data}=await post('options',values);
 const publicKey=browserOptions(data.options,action==='register');
 const credential=action==='register'?await navigator.credentials.create({publicKey}):await navigator.credentials.get({publicKey});
 await post('verify',{ceremony_id:data.ceremony_id,credential:credentialJSON(credential)});
}
export function passkeyError(error){
 if(error?.name==='NotAllowedError'||error?.name==='AbortError')return 'Passkey confirmation was cancelled or timed out. Your account has not changed. Try again when ready.';
 if(error?.name==='InvalidStateError')return 'This passkey is already saved. Try signing in instead, or choose another passkey.';
 if(error?.name==='SecurityError')return 'Open the kitchen’s main website in your browser to use a passkey.';
 const data=error?.response?.data;
 const message=typeof data?.detail==='string'?data.detail:Array.isArray(data)?data[0]:data&&typeof data==='object'?Object.values(data).flat().find(v=>typeof v==='string'):null;
 return message||error?.message||'Passkey confirmation could not finish. Please try again.';
}
