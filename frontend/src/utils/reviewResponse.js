import {invalidResponse} from './apiResponse.js';

export function reviewPage(rows,before){
 if(!Array.isArray(rows) || rows.length>20 || !rows.every(row=>Number.isSafeInteger(row?.id) && row.id>0 && Number.isInteger(row.rating) && row.rating>=1 && row.rating<=5 && typeof row.comment==='string' && typeof row.customer==='string'))throw invalidResponse();
 if(before!=null && (!/^[1-9]\d{0,18}$/.test(before) || String(rows.at(-1)?.id)!==before))throw invalidResponse();
 return {rows,before:before??null};
}
