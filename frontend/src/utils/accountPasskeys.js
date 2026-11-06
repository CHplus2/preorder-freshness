import {invalidResponse} from './apiResponse.js';
export function accountPasskeys(data){
 const rows=data?.passkeys;
 if(!Array.isArray(rows)||rows.length<1||rows.length>5||new Set(rows.map(row=>row?.id)).size!==rows.length||rows.some(row=>!Number.isSafeInteger(row?.id)||row.id<1||typeof row.label!=='string'||!row.label.trim()||row.label.length>80||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at))))throw invalidResponse();
 return rows;
}
