export function invalidResponse() {
 const error=new Error('Unexpected API response');
 error.code='INVALID_RESPONSE';
 return error;
}
export function responseList(data) {
 const rows=Array.isArray(data)?data:data?.results;
 if(!Array.isArray(rows) || rows.some(row=>!row || typeof row!=='object' || Array.isArray(row)))throw invalidResponse();
 return rows;
}
export function responseSlots(data) {
 if(!Array.isArray(data?.slots) || data.slots.some(slot=>!slot || typeof slot.delivery_at!=='string' || !Number.isFinite(Date.parse(slot.delivery_at))))throw invalidResponse();
 return data.slots;
}
