import {responseList,invalidResponse} from './apiResponse.js';
export function customerAccounts(data){
 const rows=responseList(data);
 if(rows.some(row=>!Number.isSafeInteger(row?.id) || row.id<1 || typeof row.username!=='string' || !row.username.trim() || typeof row.is_active!=='boolean' || typeof row.is_staff!=='boolean') || new Set(rows.map(row=>row.id)).size!==rows.length)throw invalidResponse();
 return rows;
}
